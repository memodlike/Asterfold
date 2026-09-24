import { afterEach, describe, expect, it, vi } from "vitest";
import { browserPerformanceSignals, rendererName, resetPerformanceSignalsForTests } from "../src/features/performance/performanceProfile";

const CACHE_KEY = "asterfold:gpu-renderer:v1";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    data,
  };
}

function stubWebGl(renderer: string) {
  const loseContext = vi.fn();
  const context = {
    RENDERER: 0x1f01,
    getExtension: vi.fn((name: string) => name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : name === "WEBGL_lose_context" ? { loseContext } : null),
    getParameter: vi.fn(() => renderer),
  };
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as RenderingContext);
  return { getContext, loseContext };
}

afterEach(() => {
  vi.restoreAllMocks();
  resetPerformanceSignalsForTests();
});

describe("GPU renderer detection", () => {
  it("probes once, releases the context and serves later tabs from cache", () => {
    const { getContext, loseContext } = stubWebGl("ANGLE (AMD Radeon R5 230)");
    const storage = memoryStorage();
    expect(rendererName(storage, 1_000)).toBe("ANGLE (AMD Radeon R5 230)");
    expect(loseContext).toHaveBeenCalledOnce();
    expect(rendererName(storage, 2_000)).toBe("ANGLE (AMD Radeon R5 230)");
    expect(getContext).toHaveBeenCalledOnce();
  });

  it("re-probes after a week, after a browser update, or when the cache is corrupt", () => {
    const { getContext } = stubWebGl("Google SwiftShader");
    const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify({ renderer: "old", agent: navigator.userAgent, checkedAt: 0 }) });
    expect(rendererName(storage, 8 * 24 * 60 * 60 * 1000)).toBe("Google SwiftShader");
    storage.data.set(CACHE_KEY, JSON.stringify({ renderer: "old", agent: "Chrome/1", checkedAt: 0 }));
    expect(rendererName(storage, 1)).toBe("Google SwiftShader");
    storage.data.set(CACHE_KEY, "{broken");
    expect(rendererName(storage, 1)).toBe("Google SwiftShader");
    storage.data.set(CACHE_KEY, JSON.stringify({ renderer: 42, agent: navigator.userAgent, checkedAt: 0 }));
    expect(rendererName(storage, 1)).toBe("Google SwiftShader");
    expect(getContext).toHaveBeenCalledTimes(4);
  });

  it("keeps working without WebGL or storage", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(rendererName(null)).toBeNull();
    const denied = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(rendererName(denied)).toBeNull();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => { throw new Error("blocked"); });
    expect(rendererName(memoryStorage())).toBeNull();
  });

  it("reads browser signals once per tab", () => {
    const { getContext } = stubWebGl("ANGLE (NVIDIA)");
    localStorage.removeItem(CACHE_KEY);
    const first = browserPerformanceSignals();
    expect(browserPerformanceSignals()).toBe(first);
    expect(getContext).toHaveBeenCalledOnce();
    localStorage.removeItem(CACHE_KEY);
  });
});
