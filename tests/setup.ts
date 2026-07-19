import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

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
