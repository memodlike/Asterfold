import { describe, expect, it } from "vitest";
import { extremesFromPixels } from "../src/features/appearance/boardContrast";
import { themeStyle } from "../src/features/appearance/themeRuntime";
import { getThemePreset } from "../src/domain/themes";

const lin = (value: number): number => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: readonly number[]): number => 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0);
const ratio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function pixels(colors: readonly (readonly [number, number, number])[]): Uint8ClampedArray {
  return Uint8ClampedArray.from(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
}

describe("board contrast against uploaded wallpapers", () => {
  it("reads the dark and bright ends of a wallpaper sample, ignoring a few outliers", () => {
    const sample = pixels([...Array<readonly [number, number, number]>(60).fill([120, 120, 120]), ...Array<readonly [number, number, number]>(30).fill([250, 250, 250]), ...Array<readonly [number, number, number]>(10).fill([0, 0, 0])]);
    const [dark, bright] = extremesFromPixels(sample);
    expect(dark).toBe("#787878");
    expect(bright).toBe("#fafafa");
  });

  it("caps glass over a bright uploaded wallpaper so dark-theme text keeps AA", () => {
    const theme = { ...getThemePreset("graphite-dark"), backgroundMode: "wallpaper" as const, wallpaperId: "upload-1", wallpaperDim: 0, surfaceOpacity: 0.4 };
    const style = themeStyle(theme, "blob:wallpaper", "blob:thumb", true, "quality", ["#f0f0f0", "#ffffff"]) as Record<string, string>;
    const clear = Number(style["--board-clear-max"]);
    const board = [38, 40, 44].map((value) => value * (1 - clear) + 255 * clear);
    expect(ratio(luminance(board), luminance([245, 245, 246]))).toBeGreaterThanOrEqual(4.5);
    // Dimming darkens the wallpaper, so the same upload allows more glass.
    const dimmed = themeStyle({ ...theme, wallpaperDim: 0.5 }, "blob:wallpaper", "blob:thumb", true, "quality", ["#f0f0f0", "#ffffff"]) as Record<string, string>;
    expect(Number(dimmed["--board-clear-max"])).toBeGreaterThan(clear);
    // Until the sample is ready an upload gets the conservative cap; built-in wallpapers are measured.
    const pending = themeStyle(theme, "blob:wallpaper", "blob:thumb", true, "quality") as Record<string, string>;
    expect(Number(pending["--board-clear-max"])).toBeLessThanOrEqual(clear);
    const builtin = themeStyle({ ...theme, wallpaperId: "builtin-aurora" }, null, null, true, "quality") as Record<string, string>;
    expect(builtin["--board-clear-max"]).toBe(".6");
  });

  it("keeps Clear lighter than Regular without an inert top of the slider", () => {
    const regular = themeStyle({ ...getThemePreset("frost-light"), glassVariant: "regular" }, null, null, false) as Record<string, string>;
    const clear = themeStyle({ ...getThemePreset("frost-light"), glassVariant: "clear" }, null, null, false) as Record<string, string>;
    expect(regular["--glass-clear-boost"]).toBe("0");
    expect(clear["--glass-clear-boost"]).toBe("1");
  });
});
