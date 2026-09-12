import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

if (!globalThis.BroadcastChannel) {
  class TestBroadcastChannel {
    public onmessage: ((event: MessageEvent) => void) | null = null;
    public constructor(public readonly name: string) {}
    public close(): void { void this.name; }
    public postMessage(message: unknown): void { void message; }
    public addEventListener(): void { void this.onmessage; }
    public removeEventListener(): void { void this.onmessage; }
    public dispatchEvent(): boolean { return true; }
  }
  Object.defineProperty(globalThis, "BroadcastChannel", { value: TestBroadcastChannel });
}

class InMemoryStorage implements Storage {
  private store = new Map<string, string>();
  public get length(): number {
    return this.store.size;
  }
  public clear(): void {
    this.store.clear();
  }
  public getItem(key: string): string | null {
    return this.store.get(String(key)) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
  public removeItem(key: string): void {
    this.store.delete(String(key));
  }
  public key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

try {
  delete (globalThis as Record<string, unknown>).localStorage;
} catch {
  // ignore
}

const testStorage =
  typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function"
    ? window.localStorage
    : new InMemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: testStorage,
  configurable: true,
  writable: true,
  enumerable: true,
});

if (typeof window !== "undefined") {
  try {
    Object.defineProperty(window, "localStorage", {
      value: testStorage,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  } catch {
    // ignore
  }
}
