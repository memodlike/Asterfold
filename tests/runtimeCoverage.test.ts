import { createElement, type ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeConfig } from "../src/domain/models";

const mocks = vi.hoisted(() => ({
  wallpaperGet: vi.fn(),
  ensureStarterWorkspace: vi.fn(),
  getWorkspaceData: vi.fn(),
  useLiveQuery: vi.fn(),
  runtimeGetUrl: vi.fn((path: string) => `chrome-extension://test${path}`),
}));

vi.mock("../src/db/database", () => ({
  db: { wallpapers: { get: mocks.wallpaperGet } },
}));

vi.mock("../src/db/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/db/repository")>();
  return {
    ...actual,
    ensureStarterWorkspace: mocks.ensureStarterWorkspace,
    getWorkspaceData: mocks.getWorkspaceData,
  };
});

vi.mock("dexie-react-hooks", () => ({ useLiveQuery: mocks.useLiveQuery }));
vi.mock("wxt/browser", () => ({ browser: { runtime: { getURL: mocks.runtimeGetUrl } } }));

import { createDefaultSettings } from "../src/db/defaults";
import { themeStyle, isDarkTheme } from "../src/features/appearance/themeRuntime";
import { useThemeRuntime } from "../src/features/appearance/useThemeRuntime";
import { useWorkspace } from "../src/app/useWorkspace";
import { parseHtmlOffThread } from "../src/services/importWorker";
import { NameDialog } from "../src/components/NameDialog";
import { MoveDialog } from "../src/components/MoveDialog";
import { Logo } from "../src/components/Logo";
import { I18nProvider } from "../src/i18n";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, { preference: "en", children });
}

function theme(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return { ...createDefaultSettings().theme, ...overrides };
}

interface WorkerEventMap {
  message: (event: MessageEvent<{ id: string; ok: boolean; result?: unknown; message?: string }>) => void;
  error: () => void;
}

class TestWorker {
  public static instances: TestWorker[] = [];
  public readonly listeners: Partial<WorkerEventMap> = {};
  public posted: { id: string; kind: string; text: string } | null = null;
  public terminated = false;

  public constructor(public readonly url: string) {
    TestWorker.instances.push(this);
  }

  public addEventListener<K extends keyof WorkerEventMap>(type: K, listener: WorkerEventMap[K]): void {
    this.listeners[type] = listener;
  }

  public postMessage(value: { id: string; kind: string; text: string }): void {
    this.posted = value;
  }

  public terminate(): void {
    this.terminated = true;
  }

  public emitMessage(data: { id: string; ok: boolean; result?: unknown; message?: string }): void {
    this.listeners.message?.(new MessageEvent("message", { data }));
  }

  public emitError(): void {
    this.listeners.error?.();
  }
}

const createObjectUrlMock = vi.fn(() => "blob:wallpaper");
const revokeObjectUrlMock = vi.fn();

describe("runtime lifecycle coverage", () => {
  const originalWorker = globalThis.Worker;
  const originalMatchMedia = globalThis.matchMedia;
  const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
  const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);

  beforeEach(() => {
    vi.clearAllMocks();
    TestWorker.instances = [];
    mocks.ensureStarterWorkspace.mockResolvedValue(undefined);
    mocks.getWorkspaceData.mockResolvedValue({ pages: [], boards: [], bookmarks: [], settings: createDefaultSettings() });
    mocks.useLiveQuery.mockReturnValue(undefined);
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: originalWorker });
    Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: originalMatchMedia });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-performance");
    document.documentElement.removeAttribute("data-asterfold-ready");
    document.documentElement.removeAttribute("data-asterfold-entering");
    document.documentElement.removeAttribute("data-asterfold-boot");
    localStorage.removeItem("asterfold:startup-theme:v1");
    document.documentElement.removeAttribute("style");
  });

  it("builds solid, builtin and uploaded wallpaper styles across light and dark palettes", () => {
    const solid = themeStyle(theme({ backgroundMode: "solid", canvas: "#010203", density: "compact" }), null, false);
    expect(solid["--color-canvas" as keyof typeof solid]).toBe("#010203");
    expect(solid["--density-space" as keyof typeof solid]).toBe("8px");

    const builtin = themeStyle(theme({
      backgroundMode: "wallpaper",
      wallpaperId: "builtin-aurora",
      wallpaperBlur: 8,
      wallpaperSaturation: 0.8,
      wallpaperZoom: 1.2,
      density: "spacious",
      glassVariant: "clear",
    }), null, true);
    expect(builtin["--wallpaper-image" as keyof typeof builtin]).toContain("quiet-aurora.webp");
    expect(builtin["--wallpaper-filter" as keyof typeof builtin]).toBe("blur(8px) saturate(0.8)");
    expect(builtin["--wallpaper-transform" as keyof typeof builtin]).toBe("scale(1.2)");
    expect(builtin["--density-space" as keyof typeof builtin]).toBe("16px");

    const uploaded = themeStyle(theme({ backgroundMode: "wallpaper", wallpaperId: "upload", wallpaperZoom: 1 }), "blob:custom", false);
    expect(uploaded["--wallpaper-image" as keyof typeof uploaded]).toBe('url("blob:custom")');
    expect(uploaded["--wallpaper-transform" as keyof typeof uploaded]).toBe("none");
  });

  it("resolves explicit and system dark mode", () => {
    expect(isDarkTheme(theme({ mode: "dark" }))).toBe(true);
    expect(isDarkTheme(theme({ mode: "light" }))).toBe(false);
    Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true })) });
    expect(isDarkTheme(theme({ mode: "system" }))).toBe(true);
  });

  it("loads and revokes an uploaded wallpaper while applying and cleaning CSS variables", async () => {
    mocks.wallpaperGet.mockResolvedValue({ blob: new Blob(["wallpaper"]) });
    const uploaded = theme({ mode: "dark", backgroundMode: "wallpaper", wallpaperId: "upload-1" });
    const view = renderHook(({ value }) => useThemeRuntime(value), { initialProps: { value: uploaded } });

    await waitFor(() => expect(createObjectUrlMock).toHaveBeenCalledOnce());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--wallpaper-image")).toContain("blob:wallpaper");

    view.rerender({ value: theme({ mode: "light", wallpaperId: "builtin-aurora" }) });
    await waitFor(() => expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:wallpaper"));
    expect(document.documentElement.dataset.theme).toBe("light");
    view.unmount();
    expect(document.documentElement.style.getPropertyValue("--color-canvas")).toBe("");
  });

  it("handles absent and failed wallpaper records", async () => {
    mocks.wallpaperGet.mockResolvedValue(undefined);
    const view = renderHook(() => useThemeRuntime(theme({ backgroundMode: "wallpaper", wallpaperId: "missing" })));
    await waitFor(() => expect(mocks.wallpaperGet).toHaveBeenCalledWith("missing"));
    expect(document.documentElement.style.getPropertyValue("--wallpaper-image")).toBe("none");

    mocks.wallpaperGet.mockRejectedValueOnce(new Error("read failed"));
    view.rerender();
    view.unmount();
  });

  it("bootstraps, queries and retries workspace state", async () => {
    let query: (() => Promise<unknown>) | undefined;
    mocks.useLiveQuery.mockImplementation((callback: () => Promise<unknown>) => {
      query = callback;
      return undefined;
    });
    const view = renderHook(() => useWorkspace());
    await waitFor(() => expect(mocks.ensureStarterWorkspace).toHaveBeenCalledOnce());
    await act(async () => { await query?.(); });
    expect(mocks.getWorkspaceData).toHaveBeenCalled();
    act(() => view.result.current.retry());
    await waitFor(() => expect(mocks.ensureStarterWorkspace).toHaveBeenCalledTimes(2));
  });

  it("reports bootstrap and live-query failures", async () => {
    mocks.ensureStarterWorkspace.mockRejectedValueOnce(new Error("bootstrap"));
    const failedBootstrap = renderHook(() => useWorkspace());
    await waitFor(() => expect(failedBootstrap.result.current.failed).toBe(true));
    failedBootstrap.unmount();

    let query: (() => Promise<unknown>) | undefined;
    mocks.ensureStarterWorkspace.mockResolvedValue(undefined);
    mocks.getWorkspaceData.mockRejectedValueOnce(new Error("query"));
    mocks.useLiveQuery.mockImplementation((callback: () => Promise<unknown>) => { query = callback; return undefined; });
    const failedQuery = renderHook(() => useWorkspace());
    await waitFor(() => expect(mocks.ensureStarterWorkspace).toHaveBeenCalled());
    await act(async () => { await query?.(); });
    await waitFor(() => expect(failedQuery.result.current.failed).toBe(true));
  });

  it("uses the synchronous HTML fallback when workers are unavailable", async () => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });
    await expect(parseHtmlOffThread('<DL><DT><A HREF="https://example.com/">Example</A></DL>')).resolves.toEqual([
      expect.objectContaining({ title: "Example", url: "https://example.com/" }),
    ]);
  });

  it("resolves worker results and ignores unrelated messages", async () => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: TestWorker });
    const pending = parseHtmlOffThread("worker input");
    const worker = TestWorker.instances[0]!;
    expect(worker.url).toBe("chrome-extension://test/import-worker.js");
    worker.emitMessage({ id: "other", ok: true, result: [] });
    worker.emitMessage({ id: worker.posted!.id, ok: true, result: [{ title: "Worker", url: "https://example.com/" }] });
    await expect(pending).resolves.toEqual([{ title: "Worker", url: "https://example.com/" }]);
    expect(worker.terminated).toBe(true);
  });

  it("rejects worker validation, worker errors, aborts and timeouts", async () => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: TestWorker });

    const invalid = parseHtmlOffThread("invalid");
    const invalidWorker = TestWorker.instances.at(-1)!;
    invalidWorker.emitMessage({ id: invalidWorker.posted!.id, ok: false, message: "invalid payload" });
    await expect(invalid).rejects.toThrow("invalid payload");

    const failed = parseHtmlOffThread("failed");
    TestWorker.instances.at(-1)!.emitError();
    await expect(failed).rejects.toThrow("Import worker failed");

    const controller = new AbortController();
    controller.abort();
    await expect(parseHtmlOffThread("aborted", controller.signal)).rejects.toMatchObject({ name: "AbortError" });

    const liveController = new AbortController();
    const cancelled = parseHtmlOffThread("cancelled", liveController.signal);
    liveController.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });

    vi.useFakeTimers();
    const timedOut = parseHtmlOffThread("timeout");
    const timeoutRejection = expect(timedOut).rejects.toThrow("Import worker timed out");
    await vi.advanceTimersByTimeAsync(30_001);
    await timeoutRejection;
  });
});

describe("dialog and semantic coverage", () => {
  const timestamp = "2026-01-01T00:00:00.000Z";
  const pages = [
    { id: "p1", userId: null, title: "Primary", icon: null, accent: null, position: "a", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
    { id: "p2", userId: null, title: "Secondary", icon: null, accent: null, position: "b", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  ];
  const boards = [
    { id: "b1", userId: null, pageId: "p1", title: "Inbox", icon: null, accent: null, position: "a", collapsed: false, layout: "list" as const, bookmarkColumns: "auto" as const, gridColumn: 1, gridRow: 0 as const, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
    { id: "b2", userId: null, pageId: "p2", title: "Archive", icon: null, accent: null, position: "b", collapsed: false, layout: "list" as const, bookmarkColumns: 1 as const, gridColumn: 1, gridRow: 0 as const, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  ];

  it("submits trimmed names and reports asynchronous errors", async () => {
    const close = vi.fn();
    const submit = vi.fn().mockResolvedValue(undefined);
    const view = render(createElement(NameDialog, { open: true, title: "Rename", label: "Title", initialValue: " Old ", onClose: close, onSubmit: submit }), { wrapper });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: " New name " } });
    fireEvent.submit(screen.getByRole("textbox", { name: "Title" }).closest("form")!);
    await waitFor(() => expect(submit).toHaveBeenCalledWith("New name"));
    expect(close).toHaveBeenCalledOnce();

    submit.mockRejectedValueOnce(new Error("save"));
    view.rerender(createElement(NameDialog, { open: true, title: "Rename", label: "Title", initialValue: "Retry", onClose: close, onSubmit: submit }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to complete the action");
  });

  it("moves boards and bookmarks, resets destinations and reports failure", async () => {
    const close = vi.fn();
    const move = vi.fn().mockResolvedValue(undefined);
    const view = render(createElement(MoveDialog, { open: true, type: "board", pages, boards, currentId: "p1", onClose: close, onMove: move }), { wrapper });
    expect(screen.getByRole("combobox")).toHaveValue("p2");
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(move).toHaveBeenCalledWith("p2"));

    move.mockRejectedValueOnce(new Error("move"));
    view.rerender(createElement(MoveDialog, { open: true, type: "bookmark", pages, boards, currentId: "b1", onClose: close, onMove: move }));
    expect(screen.getByRole("combobox")).toHaveValue("b2");
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to complete the action");
  });

  it("disables movement when no destination exists", () => {
    render(createElement(MoveDialog, { open: true, type: "board", pages: [pages[0]!], boards, currentId: "p1", onClose: vi.fn(), onMove: vi.fn() }), { wrapper });
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
  });

  it("renders the product logo as an accessible image", () => {
    render(createElement(Logo));
    expect(screen.getByRole("img", { name: "Asterfold" })).toBeVisible();
  });
});
