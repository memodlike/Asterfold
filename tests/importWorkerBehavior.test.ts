import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const browserMock = vi.hoisted(() => ({ runtime: { getURL: vi.fn((path: string) => `chrome-extension://test${path}`) } }));
vi.mock("wxt/browser", () => ({ browser: browserMock }));

import { parseHtmlOffThread } from "../src/services/importWorker";

interface WorkerPayload { id: string; kind: string; text: string }
type Listener = (event: Event | MessageEvent) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly url: string;
  readonly listeners = new Map<string, Listener[]>();
  posted: WorkerPayload | null = null;
  terminated = false;

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback: Listener = typeof listener === "function" ? listener as Listener : (event) => listener.handleEvent(event);
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  postMessage(payload: WorkerPayload): void {
    this.posted = payload;
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(data: unknown): void {
    for (const listener of this.listeners.get("message") ?? []) listener(new MessageEvent("message", { data }));
  }

  emitError(): void {
    for (const listener of this.listeners.get("error") ?? []) listener(new Event("error"));
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("request-id") });
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("import worker lifecycle", () => {
  it("falls back to main-thread HTML parsing when workers are unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    const records = await parseHtmlOffThread('<DL><DT><A HREF="https://example.com/">Example</A></DL>');
    expect(records).toHaveLength(1);
    expect(records[0]?.url).toBe("https://example.com/");
  });

  it("rejects an already aborted request before creating a worker", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(parseHtmlOffThread("<DL></DL>", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("resolves matching worker responses and ignores unrelated messages", async () => {
    const pending = parseHtmlOffThread("<DL></DL>");
    const worker = FakeWorker.instances[0]!;
    expect(worker.url).toContain("/import-worker.js");
    expect(worker.posted).toEqual({ id: "request-id", kind: "html", text: "<DL></DL>" });
    worker.emitMessage({ id: "other", ok: true, result: [{ title: "Wrong" }] });
    worker.emitMessage({ id: "request-id", ok: true, result: [{ title: "Example", url: "https://example.com/", description: null, folderPath: [] }] });
    await expect(pending).resolves.toHaveLength(1);
    expect(worker.terminated).toBe(true);
  });

  it("rejects validation failures and worker errors", async () => {
    const validation = parseHtmlOffThread("<DL></DL>");
    const first = FakeWorker.instances[0]!;
    first.emitMessage({ id: "request-id", ok: false, message: "invalid input" });
    await expect(validation).rejects.toThrow("invalid input");
    expect(first.terminated).toBe(true);

    const failed = parseHtmlOffThread("<DL></DL>");
    const second = FakeWorker.instances[1]!;
    second.emitError();
    await expect(failed).rejects.toThrow("Import worker failed");
    expect(second.terminated).toBe(true);
  });

  it("aborts active workers and removes listeners", async () => {
    const controller = new AbortController();
    const pending = parseHtmlOffThread("<DL></DL>", controller.signal);
    const worker = FakeWorker.instances[0]!;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminated).toBe(true);
  });

  it("times out stalled workers", async () => {
    vi.useFakeTimers();
    const pending = parseHtmlOffThread("<DL></DL>");
    const worker = FakeWorker.instances[0]!;
    const timeoutRejection = expect(pending).rejects.toThrow("Import worker timed out");
    await vi.advanceTimersByTimeAsync(30_001);
    await timeoutRejection;
    expect(worker.terminated).toBe(true);
  });
});
