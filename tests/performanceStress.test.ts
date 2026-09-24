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
    // Settings writes lowPowerMode: true together with the solid tier; the solid tier must still apply.
    expect(classifyPerformanceMode("software", true, modern)).toBe("software");
    expect(classifyPerformanceMode("auto", true, modern)).toBe("compatibility");
  });

  it("keeps compatibility and software tiers free of live backdrop and layout-sized transitions", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/global.css`, "utf8");
    const material = readFileSync(`${process.cwd()}/src/styles/material.css`, "utf8");
    const compatibilityWallpaper = /html\[data-performance="compatibility"\] \.wallpaper \{[^}]+\}/u.exec(css)?.[0] ?? "";
    expect(compatibilityWallpaper).toContain("--wallpaper-compat-image");
    expect(css).toContain("--wallpaper-software-image");
    for (const tier of ["compatibility", "software"]) {
      const block = new RegExp(`html\\[data-performance="${tier}"\\] \\{[^}]+\\}`, "u").exec(material)?.[0] ?? "";
      expect(block, tier).toContain("--mat-filter: none");
      expect(block, tier).toContain("--settings-scrim-filter: none");
    }
    const software = /html\[data-performance="software"\] \{[^}]+\}/u.exec(material)?.[0] ?? "";
    for (const token of ["--mat-alpha-menu: 1", "--mat-alpha-sheet: 1", "--mat-alpha-tile: 1", "--mat-alpha-pill: 1", "--enter-y: 0px", "--enter-scale: 1"]) expect(software).toContain(token);
    const balanced = /html\[data-performance="balanced"\] \{[^}]+\}/u.exec(material)?.[0] ?? "";
    expect(balanced).toContain("--settings-scrim-filter: none");
    expect(css).not.toContain(".private-content { filter:");
  });

  it("animates only compositor properties across every stylesheet", () => {
    const files = [
      "src/styles/global.css", "src/styles/material.css", "src/styles/controls.css", "src/styles/design-hardening.css",
      "src/app/launcher.css", "src/features/search/spotlight.css", "src/features/settings/settings.css",
      "src/features/onboarding/onboarding.css", "entrypoints/popup/popup.css", "entrypoints/newtab/bootstrap.css",
    ];
    for (const file of files) {
      const css = readFileSync(`${process.cwd()}/${file}`, "utf8");
      expect(css, file).not.toMatch(/transition:\s*[^;]*(?:width|height|margin|padding|box-shadow|backdrop-filter|filter)\b/u);
      expect(css, file).not.toMatch(/transition:\s*all\b/u);
      for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n?\}\n/gu)) {
        expect(body, file).not.toMatch(/(?:width|height|margin|box-shadow|blur|backdrop-filter)\s*:/u);
      }
    }
  });

  it("blurs Settings once through the scrim instead of per tile", () => {
    const settings = readFileSync(`${process.cwd()}/src/features/settings/settings.css`, "utf8");
    const material = readFileSync(`${process.cwd()}/src/styles/material.css`, "utf8");
    const runtime = readFileSync(`${process.cwd()}/src/features/appearance/themeRuntime.ts`, "utf8");
    expect(runtime).toContain("quiet-aurora-compat.webp");
    expect(runtime).toContain("blue-mesh-compat.webp");
    expect(runtime).toContain("dusk-compat.webp");
    expect(runtime).not.toContain("-compat.svg");
    const tile = /\.settings-tile \{[^}]+\}/u.exec(settings)?.[0] ?? "";
    expect(tile).not.toContain("backdrop-filter");
    expect(settings).toMatch(/\.modal-backdrop--settings::before \{[^}]*backdrop-filter: var\(--settings-scrim-filter\)/u);
    expect(settings).toMatch(/\.modal\.settings-modal \{[^}]*backdrop-filter: none/u);
    // The scrim animates on a pseudo-element so the backdrop never becomes a Chrome backdrop root.
    expect(material).toMatch(/\.modal-backdrop::before \{[^}]*animation: af-fade/u);
    expect(material).not.toMatch(/\.modal-backdrop \{[^}]*animation/u);
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
