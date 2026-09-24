import type { GradientConfig, ThemeConfig } from "../../domain/models";

/**
 * Accent colours are derived once, when the background changes, and stored in the theme.
 * The new-tab startup path only reads `theme.accent`; nothing here runs on every tab open.
 */

type Rgb = readonly [number, number, number];

const HEX = /^#[0-9a-f]{6}$/i;

/** Measured from the shipped wallpapers with `accentFromPixels` on a 48×32 decode. */
export const BUILTIN_WALLPAPER_ACCENTS: Readonly<Record<string, string>> = {
  "builtin-aurora": "#4a57b5",
  "builtin-mesh": "#4aa8b5",
  "builtin-dusk": "#aa48b7",
};

export const ACCENT_SWATCHES = ["#5b8cff", "#8b7cf6", "#e36fb0", "#f08a4b", "#2fb58f", "#3fb6d9"] as const;

const DARK_SURFACE: Rgb = [27, 28, 32];
const LIGHT_SURFACE: Rgb = [255, 255, 255];

export function hexToRgb(hex: string): Rgb | null {
  if (!HEX.test(hex)) return null;
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0")).join("")}`;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r, g, b] = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] : segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return [(r + offset) * 255, (g + offset) * 255, (b + offset) * 255];
}

/**
 * Shifts lightness (keeping hue) until the accent reaches 3:1 against the theme surface,
 * the WCAG AA threshold for UI components such as slider fills and focus rings.
 */
export function readableAccent(hex: string, dark: boolean): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return dark ? "#8fb0ff" : "#155eef";
  const surface = dark ? DARK_SURFACE : LIGHT_SURFACE;
  if (contrastRatio(rgb, surface) >= 3) return hex.toLowerCase();
  const [hue, saturation, lightness] = rgbToHsl(rgb);
  let candidate = lightness;
  for (let step = 0; step < 40; step += 1) {
    candidate = dark ? Math.min(0.96, candidate + 0.02) : Math.max(0.08, candidate - 0.02);
    const next = hslToRgb(hue, saturation, candidate);
    if (contrastRatio(next, surface) >= 3) return rgbToHex(next);
  }
  return rgbToHex(hslToRgb(hue, saturation, candidate));
}

/** Text colour for content placed on an accent fill (primary buttons, lit toggles). */
export function onAccentColor(hex: string): string {
  const rgb = hexToRgb(hex) ?? [21, 94, 239];
  return contrastRatio(rgb, [255, 255, 255]) >= contrastRatio(rgb, [17, 17, 20]) ? "#ffffff" : "#111114";
}

export function accentFromGradient(gradient: GradientConfig | undefined): string | null {
  let best: { color: string; score: number } | null = null;
  for (const point of gradient?.points ?? []) {
    if (!point.enabled) continue;
    const rgb = hexToRgb(point.color);
    if (!rgb) continue;
    const [, saturation, lightness] = rgbToHsl(rgb);
    const score = saturation * point.opacity * (1 - Math.abs(lightness - 0.55));
    if (!best || score > best.score) best = { color: point.color.toLowerCase(), score };
  }
  return best?.color ?? null;
}

/**
 * Picks a representative vivid colour from RGBA pixels: a saturation-weighted hue histogram,
 * then the mean colour of the winning hue bucket. Grey and near-black pixels are ignored.
 */
export function accentFromPixels(data: ArrayLike<number>): string | null {
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  for (let index = 0; index + 3 < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;
    if (alpha < 128) continue;
    const rgb: Rgb = [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0];
    const [hue, saturation, lightness] = rgbToHsl(rgb);
    if (saturation < 0.18 || lightness < 0.12 || lightness > 0.92) continue;
    const weight = saturation * (1 - Math.abs(lightness - 0.5) * 1.4);
    if (weight <= 0) continue;
    const bucket = buckets[Math.floor(hue / 15) % 24];
    if (!bucket) continue;
    bucket.weight += weight;
    bucket.r += rgb[0] * weight;
    bucket.g += rgb[1] * weight;
    bucket.b += rgb[2] * weight;
  }
  const winner = buckets.reduce((best, bucket) => bucket.weight > best.weight ? bucket : best);
  if (winner.weight < 0.5) return null;
  const mean: Rgb = [winner.r / winner.weight, winner.g / winner.weight, winner.b / winner.weight];
  const [hue, saturation, lightness] = rgbToHsl(mean);
  return rgbToHex(hslToRgb(hue, Math.min(0.78, Math.max(0.42, saturation)), Math.min(0.72, Math.max(0.5, lightness))));
}

/** Samples a small decode of an image blob. Runs only when the user picks a new upload. */
export async function accentFromImageBlob(blob: Blob): Promise<string | null> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(blob, { resizeWidth: 48, resizeHeight: 32, resizeQuality: "low" });
    const canvas = new OffscreenCanvas(48, 32);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) { bitmap.close(); return null; }
    context.drawImage(bitmap, 0, 0, 48, 32);
    bitmap.close();
    return accentFromPixels(context.getImageData(0, 0, 48, 32).data);
  } catch {
    return null;
  }
}

/** The accent a theme should carry when it follows its background. `null` keeps the current one. */
export function automaticAccent(theme: ThemeConfig, uploadedAccent: string | null = null): string | null {
  if (theme.backgroundMode === "gradient") return accentFromGradient(theme.gradient);
  if (theme.backgroundMode === "wallpaper" && theme.wallpaperId) {
    return BUILTIN_WALLPAPER_ACCENTS[theme.wallpaperId] ?? uploadedAccent;
  }
  return null;
}
