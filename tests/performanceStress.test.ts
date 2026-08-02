import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyPerformanceMode, type PerformanceSignals } from "../src/features/performance/performanceProfile";

const modern: PerformanceSignals = {
  renderer: "ANGLE (NVIDIA GeForce RTX 4060 Direct3D11)",
  platform: "Windows",
  deviceMemory: 16,
  hardwareConcurrency: 16,
  reducedTransparency: false,
};

describe("Windows 11 adaptive rendering stress gates", () => {
  it("routes the corporate Radeon R5 230 profile to compatibility glass", () => {
    expect(classifyPerformanceMode("auto", false, { ...modern, renderer: "ANGLE (AMD Radeon R5 230 Direct3D11 vs_5_0 ps_5_0)" })).toBe("compatibility");
    expect(classifyPerformanceMode("auto", false, { ...modern, renderer: "AMD CAICOS" })).toBe("compatibility");
  });

  it("routes software renderers to the strongest fallback", () => {
    expect(classifyPerformanceMode("auto", false, { ...modern, renderer: "Google SwiftShader" })).toBe("software");
    expect(classifyPerformanceMode("auto", false, { ...modern, renderer: "Microsoft Basic Render Driver" })).toBe("software");
  });

  it("respects explicit rendering choices", () => {
    expect(classifyPerformanceMode("quality", false, { ...modern, renderer: "Google SwiftShader" })).toBe("quality");
    expect(classifyPerformanceMode("compatibility", false, modern)).toBe("compatibility");
  });

  it("keeps compatibility mode free of live backdrop and layout-sized transitions", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/global.css`, "utf8");
    const compatibilityRule = /html\[data-performance="compatibility"\][\s\S]+?\.motion-disabled/u.exec(css)?.[0] ?? "";
    expect(compatibilityRule).toContain("backdrop-filter: none");
    expect(compatibilityRule).toContain("--wallpaper-compat-image");
    expect(css).not.toMatch(/transition:\s*[^;]*(?:width|margin|box-shadow)/u);
    expect(css).not.toContain(".private-content { filter:");
  });

  it("caps decoded uploaded wallpapers at a Full HD long edge", async () => {
    const { WALLPAPER_LIMITS } = await import("../src/domain/mediaLimits");
    expect(WALLPAPER_LIMITS.outputDimension).toBe(1_920);
  });
});
