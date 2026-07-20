import { describe, expect, it } from "vitest";
import { initialPerformanceTier, shouldReduceForFrameSamples } from "../src/features/appearance/performance";

describe("performance fallback", () => {
  it("uses the low-cost renderer for reduced motion and constrained hardware", () => {
    expect(initialPerformanceTier({ prefersReducedMotion: true, hardwareConcurrency: 12, deviceMemory: 16 })).toBe("reduced");
    expect(initialPerformanceTier({ hardwareConcurrency: 4, deviceMemory: 8 })).toBe("reduced");
    expect(initialPerformanceTier({ hardwareConcurrency: 8, deviceMemory: 4 })).toBe("reduced");
    expect(initialPerformanceTier({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe("standard");
  });

  it("falls back after repeated slow frames instead of a single transient stall", () => {
    expect(shouldReduceForFrameSamples([16, 17, 42, 16, 44, 15, 48])).toBe(true);
    expect(shouldReduceForFrameSamples([16, 17, 42, 16, 18, 15, 20])).toBe(false);
  });
});
