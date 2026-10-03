/*
 * Board glass may let at most BOARD_CLEAR_MAX of the background through. When the background
 * colours are known (solid, gradient, theme canvas), the share is lowered further until board
 * text keeps WCAG AA over each of them: CSS composites the board tint over the background in
 * sRGB, so the check uses the same mix. Primary text gets a margin for the sheen/highlight
 * layers; secondary (vibrancy) text gets the plain 4.5:1. Wallpapers are not sampled here —
 * the cap is measured on the built-in ones in e2e/glass.spec.ts.
 */

export const BOARD_CLEAR_MAX = 0.6;
const PRIMARY_TARGET = 4.8;
const SECONDARY_TARGET = 4.5;
const VIBRANCY_MIX = 0.4;

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

/** Largest background share (0…BOARD_CLEAR_MAX, 0.01 steps) that keeps board text readable. */
export function boardClearMax(surface: Rgb, text: Rgb, secondary: Rgb, backgrounds: readonly Rgb[]): number {
  const vibrancy = mix(secondary, text, VIBRANCY_MIX);
  let best = BOARD_CLEAR_MAX;
  for (const background of backgrounds) {
    let clear = best;
    while (clear > 0) {
      const board = mix(surface, background, clear);
      if (contrast(board, text) >= PRIMARY_TARGET && contrast(board, vibrancy) >= SECONDARY_TARGET) break;
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
