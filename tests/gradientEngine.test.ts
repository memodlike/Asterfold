import { describe, expect, it } from "vitest";
import {
  GRADIENT_PRESETS,
  compileGradientCss,
  generateRandomCuratedGradient,
  getDefaultGradientConfig,
  hexToRgba,
} from "../src/features/appearance/gradientEngine";
import { isValidHexColor } from "../src/domain/themes";

describe("gradient engine", () => {
  it("provides valid built-in presets with properly bounded points", () => {
    const presets = ["current", "cool", "aurora", "warm", "neutral"] as const;
    for (const presetId of presets) {
      const config = GRADIENT_PRESETS[presetId];
      expect(config.preset).toBe(presetId);
      expect(config.points.length).toBeGreaterThanOrEqual(1);
      expect(config.points.length).toBeLessThanOrEqual(10);
      for (const p of config.points) {
        expect(isValidHexColor(p.color)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
        expect(p.opacity).toBeGreaterThan(0);
        expect(p.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it("returns the default Current configuration", () => {
    const defaultConfig = getDefaultGradientConfig();
    expect(defaultConfig.preset).toBe("current");
    expect(defaultConfig.points.length).toBe(3);
  });

  it("converts hex to valid rgba strings", () => {
    expect(hexToRgba("#5b8cff", 0.4)).toBe("rgba(91, 140, 255, 0.40)");
    expect(hexToRgba("#000000", 1)).toBe("rgba(0, 0, 0, 1.00)");
    expect(hexToRgba("#ffffff", 0)).toBe("rgba(255, 255, 255, 0.00)");
    // Fallback on invalid hex
    expect(hexToRgba("invalid", 0.5)).toContain("rgba(");
  });

  it("compiles native layered radial gradients for quality mode", () => {
    const config = GRADIENT_PRESETS.cool;
    const css = compileGradientCss(config, true, "quality");
    expect(css).toContain("radial-gradient(circle at 15% 20%");
    expect(css).toContain("radial-gradient(circle at 85% 25%");
    expect(css.split("radial-gradient").length - 1).toBe(4);
  });

  it("caps points to top 3 in software mode for low-end graphics performance", () => {
    const config = {
      preset: "custom" as const,
      points: [
        { id: "1", color: "#111111", x: 10, y: 10, spread: 50, opacity: 0.5, enabled: true },
        { id: "2", color: "#222222", x: 20, y: 20, spread: 50, opacity: 0.5, enabled: true },
        { id: "3", color: "#333333", x: 30, y: 30, spread: 50, opacity: 0.5, enabled: true },
        { id: "4", color: "#444444", x: 40, y: 40, spread: 50, opacity: 0.5, enabled: true },
        { id: "5", color: "#555555", x: 50, y: 50, spread: 50, opacity: 0.5, enabled: true },
      ],
    };
    const css = compileGradientCss(config, true, "software");
    expect(css.split("radial-gradient").length - 1).toBe(3);
  });

  it("returns none when all points are disabled or points list is empty", () => {
    const empty = { preset: "custom" as const, points: [] };
    expect(compileGradientCss(empty, true, "quality")).toBe("none");

    const disabled = {
      preset: "custom" as const,
      points: [{ id: "1", color: "#111111", x: 10, y: 10, spread: 50, opacity: 0.5, enabled: false }],
    };
    expect(compileGradientCss(disabled, true, "quality")).toBe("none");
  });

  it("generates aesthetically curated random compositions with distributed points", () => {
    for (let i = 0; i < 10; i += 1) {
      const random = generateRandomCuratedGradient(true);
      expect(random.preset).toBe("custom");
      expect(random.points.length).toBeGreaterThanOrEqual(2);
      expect(random.points.length).toBeLessThanOrEqual(10);

      // Verify no two points have identical coordinates
      const positions = new Set(random.points.map((p) => `${p.x},${p.y}`));
      expect(positions.size).toBe(random.points.length);

      for (const p of random.points) {
        expect(isValidHexColor(p.color)).toBe(true);
        expect(p.opacity).toBeGreaterThanOrEqual(0.1);
        expect(p.opacity).toBeLessThanOrEqual(0.6);
        expect(p.spread).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("supports explicit count during random generation", () => {
    const random = generateRandomCuratedGradient(false, 7);
    expect(random.points.length).toBe(7);
  });
});
