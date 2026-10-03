/*
 * Board glass may let at most BOARD_CLEAR_MAX of the background through. When the background
 * colours are known (solid, gradient, theme canvas), the share is lowered further until board
 * text keeps WCAG AA over each of them: CSS composites the board tint over the background in
 * sRGB, so the check uses the same mix. Primary text gets a margin for the sheen/highlight
 * layers and must still hold 4.5:1 under the white pointer highlight. Text on board glass uses
 * the primary colour (the empty-board hint included), so no gray text limits the material. Wallpapers contribute their darkest and brightest colours from a 48×32
 * decode: measured once for the built-in ones, sampled at load for uploads.
 */

export const BOARD_CLEAR_MAX = 0.6;
const PRIMARY_TARGET = 4.8;
const LIT_TARGET = 4.5;

type Rgb = readonly [number, number, number];

export function parseRgb(value: string): Rgb | null {
  const hex = /^#([0-9a-f]{6})$/iu.exec(value.trim());
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const parts = value.trim().split(/\s+/u).map(Number);
  return parts.length === 3 && parts.every((part) => Number.isFinite(part)) ? [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0] : null;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: Rgb, b: Rgb, share: number): Rgb {
  return [a[0] * (1 - share) + b[0] * share, a[1] * (1 - share) + b[1] * share, a[2] * (1 - share) + b[2] * share];
}

/** Darkest and brightest colours of the shipped wallpapers (full and lightweight files, 48×32). */
export const BUILTIN_WALLPAPER_EXTREMES: Readonly<Record<string, readonly [string, string]>> = {
  "builtin-aurora": ["#060202", "#fef0c4"],
  "builtin-mesh": ["#162829", "#cdcfa6"],
  "builtin-dusk": ["#050109", "#fff0fe"],
};

/** Largest background share (0…BOARD_CLEAR_MAX, 0.01 steps) that keeps board text readable. */
export function boardClearMax(surface: Rgb, text: Rgb, backgrounds: readonly Rgb[], glare = 0): number {
  let best = BOARD_CLEAR_MAX;
  for (const background of backgrounds) {
    let clear = best;
    while (clear > 0) {
      const board = mix(surface, background, clear);
      const lit = mix(board, [255, 255, 255], glare);
      if (contrast(board, text) >= PRIMARY_TARGET && contrast(lit, text) >= LIT_TARGET) break;
      clear = Math.round((clear - 0.01) * 100) / 100;
    }
    best = Math.max(0, clear);
  }
  return best;
}

/** CSS number without a leading zero, matching the token style (".6", ".34"). */
export function cssShare(value: number): string {
  return String(Math.round(value * 100) / 100).replace(/^0\./u, ".");
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/** Darkest and brightest colour of RGBA pixels. The 48×32 downscale already averages away
 * single-pixel noise, so nothing more is discarded: a thin bright stripe still counts. */
export function extremesFromPixels(data: ArrayLike<number>): [string, string] {
  let darkest: Rgb | null = null;
  let brightest: Rgb | null = null;
  for (let index = 0; index + 3 < data.length; index += 4) {
    const color: Rgb = [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0];
    if (!darkest || luminance(color) < luminance(darkest)) darkest = color;
    if (!brightest || luminance(color) > luminance(brightest)) brightest = color;
  }
  return darkest && brightest ? [hex(darkest), hex(brightest)] : ["#000000", "#ffffff"];
}

/** Samples an uploaded wallpaper (its bounded thumbnail when present) for the contrast cap. */
export async function sampleWallpaperExtremes(blob: Blob): Promise<[string, string] | null> {
  try {
    const bitmap = await createImageBitmap(blob, { resizeWidth: 48, resizeHeight: 32, resizeQuality: "low" });
    const canvas = new OffscreenCanvas(48, 32);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, 48, 32);
    bitmap.close();
    return extremesFromPixels(context.getImageData(0, 0, 48, 32).data);
  } catch {
    return null;
  }
}

/** The wallpaper dim layer is black at `dim` opacity over the image. */
export function dimmed(color: string, dim: number): string | null {
  const rgb = parseRgb(color);
  return rgb ? hex([rgb[0] * (1 - dim), rgb[1] * (1 - dim), rgb[2] * (1 - dim)]) : null;
}
