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
    expect(css).toContain("--wallpaper-software-image");
    expect(css).not.toMatch(/transition:\s*[^;]*(?:width|margin|box-shadow)/u);
    expect(css).not.toContain(".private-content { filter:");
  });


  it("uses raster compatibility wallpapers and keeps Settings opaque", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/global.css`, "utf8");
    const runtime = readFileSync(`${process.cwd()}/src/features/appearance/themeRuntime.ts`, "utf8");
    expect(runtime).toContain("quiet-aurora-compat.webp");
    expect(runtime).toContain("blue-mesh-compat.webp");
    expect(runtime).toContain("dusk-compat.webp");
    expect(runtime).not.toContain("-compat.svg");
    expect(css).toMatch(/\.settings-modal\s*\{[^}]*background:\s*var\(--color-surface-elevated\)/u);
    expect(css).toMatch(/\.settings-modal\s*\{[^}]*backdrop-filter:\s*none/u);
  });

  it("preserves original uploads and limits only the software fallback", async () => {
    const { WALLPAPER_LIMITS } = await import("../src/domain/mediaLimits");
    const pipeline = readFileSync(`${process.cwd()}/src/services/wallpaper.ts`, "utf8");
    expect(WALLPAPER_LIMITS.sourceDimension).toBe(16_384);
    expect(WALLPAPER_LIMITS.outputDimension).toBe(1_920);
    expect(pipeline).toContain("const original = file.slice(0, file.size, info.mimeType)");
    expect(pipeline).not.toMatch(/const scale[\s\S]{0,240}blob:\s*encoded\.blob/u);
  });
});
