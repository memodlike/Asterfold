import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCENT_SWATCHES,
  BUILTIN_WALLPAPER_ACCENTS,
  accentFromGradient,
  accentFromImageBlob,
  accentFromPixels,
  automaticAccent,
  contrastRatio,
  hexToRgb,
  onAccentColor,
  readableAccent,
  rgbToHex,
} from "../src/features/appearance/accent";
import { getThemePreset, validateTheme } from "../src/domain/themes";
import { themeStyle } from "../src/features/appearance/themeRuntime";
import { applyPopupTheme } from "../src/features/appearance/popupTheme";
import type { ThemeConfig } from "../src/domain/models";

const DARK_SURFACE = [27, 28, 32] as const;
const WHITE = [255, 255, 255] as const;

function theme(patch: Partial<ThemeConfig> = {}): ThemeConfig {
  return validateTheme({ ...getThemePreset("graphite-dark"), ...patch });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accent colour engine", () => {
  it("converts between hex and rgb and rejects malformed colours", () => {
    expect(hexToRgb("#aa48b7")).toEqual([170, 72, 183]);
    expect(hexToRgb("purple")).toBeNull();
    expect(rgbToHex([300, -4, 15.6])).toBe("#ff0010");
  });

  it("guarantees 3:1 UI contrast against both theme surfaces", () => {
    for (const color of ["#000000", "#ffffff", "#ffff00", "#101060", ...ACCENT_SWATCHES, ...Object.values(BUILTIN_WALLPAPER_ACCENTS)]) {
      expect(contrastRatio(hexToRgb(readableAccent(color, true))!, DARK_SURFACE), `${color} dark`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hexToRgb(readableAccent(color, false))!, WHITE), `${color} light`).toBeGreaterThanOrEqual(3);
    }
    expect(readableAccent("not-a-colour", true)).toBe("#8fb0ff");
    expect(readableAccent("not-a-colour", false)).toBe("#155eef");
  });

  it("chooses the more legible text colour for accent fills", () => {
    expect(onAccentColor("#155eef")).toBe("#ffffff");
    expect(onAccentColor("#ffd84d")).toBe("#111114");
    expect(onAccentColor("broken")).toBe("#ffffff");
  });

  it("derives a gradient accent from its most vivid enabled point", () => {
    expect(accentFromGradient({ preset: "custom", points: [
      { id: "a", color: "#808080", x: 0, y: 0, spread: 50, opacity: 1, enabled: true },
      { id: "b", color: "#e0457b", x: 0, y: 0, spread: 50, opacity: .4, enabled: true },
      { id: "c", color: "#00ff00", x: 0, y: 0, spread: 50, opacity: 1, enabled: false },
      { id: "d", color: "oops", x: 0, y: 0, spread: 50, opacity: 1, enabled: true },
    ] })).toBe("#e0457b");
    expect(accentFromGradient(undefined)).toBeNull();
  });

  it("finds the dominant vivid hue in pixel data and ignores greys", () => {
    const pixels: number[] = [];
    for (let index = 0; index < 40; index += 1) pixels.push(40, 90, 220, 255);
    for (let index = 0; index < 60; index += 1) pixels.push(128, 128, 128, 255);
    for (let index = 0; index < 5; index += 1) pixels.push(220, 60, 40, 255);
    for (let index = 0; index < 5; index += 1) pixels.push(220, 60, 40, 0);
    const accent = accentFromPixels(pixels);
    expect(accent).not.toBeNull();
    const [r, , b] = hexToRgb(accent!)!;
    expect(b).toBeGreaterThan(r);
    expect(accentFromPixels(new Array(400).fill(128))).toBeNull();
  });

  it("samples uploaded images through a tiny off-screen decode", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close }));
    const data = new Uint8ClampedArray(48 * 32 * 4);
    for (let index = 0; index < data.length; index += 4) data.set([30, 180, 120, 255], index);
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() { return { drawImage: vi.fn(), getImageData: () => ({ data }) }; }
    });
    const accent = await accentFromImageBlob(new Blob(["x"]));
    expect(accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(close).toHaveBeenCalledOnce();

    vi.stubGlobal("OffscreenCanvas", class { getContext() { return null; } });
    expect(await accentFromImageBlob(new Blob(["x"]))).toBeNull();
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));
    expect(await accentFromImageBlob(new Blob(["x"]))).toBeNull();
    vi.stubGlobal("createImageBitmap", undefined);
    expect(await accentFromImageBlob(new Blob(["x"]))).toBeNull();
  });

  it("follows built-in wallpapers and gradients, and keeps uploads on the stored accent", () => {
    expect(automaticAccent(theme({ backgroundMode: "wallpaper", wallpaperId: "builtin-dusk" }))).toBe(BUILTIN_WALLPAPER_ACCENTS["builtin-dusk"]);
    expect(automaticAccent(theme({ backgroundMode: "wallpaper", wallpaperId: "upload-1" }), "#123456")).toBe("#123456");
    expect(automaticAccent(theme({ backgroundMode: "wallpaper", wallpaperId: "upload-1" }))).toBeNull();
    expect(automaticAccent(theme({ backgroundMode: "gradient" }))).toMatch(/^#/);
    expect(automaticAccent(theme({ backgroundMode: "solid" }))).toBeNull();
  });
});

describe("accent runtime wiring", () => {
  it("defaults legacy themes to automatic accents and rejects unknown modes", () => {
    const legacy = { ...getThemePreset("graphite-dark") } as Partial<ThemeConfig>;
    delete legacy.accentMode;
    expect(validateTheme(legacy as ThemeConfig).accentMode).toBe("auto");
    expect(validateTheme({ ...getThemePreset("graphite-dark"), accentMode: "neon" } as unknown as ThemeConfig).accentMode).toBe("auto");
    expect(validateTheme({ ...getThemePreset("graphite-dark"), accentMode: "custom" }).accentMode).toBe("custom");
  });

  it("paints the wallpaper accent unless the user picked one", () => {
    const auto = themeStyle(theme({ backgroundMode: "wallpaper", wallpaperId: "builtin-dusk", accent: "#155eef" }), null, null, true) as Record<string, string>;
    expect(auto["--color-accent"]).toBe(readableAccent(BUILTIN_WALLPAPER_ACCENTS["builtin-dusk"]!, true));
    expect(auto["--color-on-accent"]).toBe(onAccentColor(auto["--color-accent"]!));
    const custom = themeStyle(theme({ backgroundMode: "wallpaper", wallpaperId: "builtin-dusk", accent: "#f08a4b", accentMode: "custom" }), null, null, true) as Record<string, string>;
    expect(custom["--color-accent"]).toBe(readableAccent("#f08a4b", true));
  });

  it("maps glass blur to overlay blur and turns it off at zero", () => {
    expect((themeStyle(theme({ blur: 20 }), null, null, true) as Record<string, string>)["--overlay-blur"]).toBe("32px");
    expect((themeStyle(theme({ blur: 0 }), null, null, true) as Record<string, string>)["--overlay-blur"]).toBe("0px");
    expect((themeStyle(theme({ blur: 32 }), null, null, true) as Record<string, string>)["--overlay-blur"]).toBe("40px");
  });

  it("gives the popup the same accent and surface tokens as the new tab", () => {
    const root = document.createElement("div");
    applyPopupTheme(root, theme({ backgroundMode: "wallpaper", wallpaperId: "builtin-mesh" }), true);
    expect(root.style.getPropertyValue("--color-accent")).toBe(readableAccent(BUILTIN_WALLPAPER_ACCENTS["builtin-mesh"]!, true));
    expect(root.style.getPropertyValue("--surface-rgb")).toBe("38 40 44");
    expect(root.style.getPropertyValue("--color-on-accent")).toMatch(/^#/);
  });
});
