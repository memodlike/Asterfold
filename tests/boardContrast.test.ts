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
  it("keeps the true dark and bright ends of a wallpaper sample, even a thin stripe", () => {
    const sample = pixels([...Array<readonly [number, number, number]>(95).fill([30, 30, 30]), ...Array<readonly [number, number, number]>(5).fill([250, 250, 250])]);
    expect(extremesFromPixels(sample)).toEqual(["#1e1e1e", "#fafafa"]);
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
  });

  it("caps built-in wallpapers by their measured ends, including the pointer highlight", () => {
    for (const [wallpaperId, bright] of [["builtin-aurora", [254, 240, 196]], ["builtin-mesh", [205, 207, 166]], ["builtin-dusk", [255, 240, 254]]] as const) {
      const theme = { ...getThemePreset("graphite-dark"), backgroundMode: "wallpaper" as const, wallpaperId, wallpaperDim: 0 };
      const style = themeStyle(theme, null, null, true, "quality") as Record<string, string>;
      const clear = Number(style["--board-clear-max"]);
      expect(clear, wallpaperId).toBeLessThan(0.6);
      const board = [38, 40, 44].map((value, index) => value * (1 - clear) + (bright[index] ?? 0) * clear);
      expect(ratio(luminance(board), luminance([245, 245, 246])), `${wallpaperId} plain`).toBeGreaterThanOrEqual(4.8);
      // The dark-theme highlight is white light on top of the capped board.
      const strength = Number(style["--glare-strength"]);
      const lit = board.map((value) => value + strength * (255 - value));
      expect(ratio(luminance(lit), luminance([245, 245, 246])), `${wallpaperId} under the highlight`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps Clear lighter than Regular without an inert top of the slider", () => {
    const regular = themeStyle({ ...getThemePreset("frost-light"), glassVariant: "regular" }, null, null, false) as Record<string, string>;
    const clear = themeStyle({ ...getThemePreset("frost-light"), glassVariant: "clear" }, null, null, false) as Record<string, string>;
    expect(regular["--glass-clear-boost"]).toBe("0");
    expect(clear["--glass-clear-boost"]).toBe("1");
  });
});
