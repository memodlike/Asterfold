import type { GradientConfig, GradientPoint, GradientPresetId } from "../../domain/models";
import type { ResolvedPerformanceMode } from "../performance/performanceProfile";

export const GRADIENT_PRESETS: Readonly<Record<Exclude<GradientPresetId, "custom">, GradientConfig>> = {
  current: {
    preset: "current",
    points: [
      { id: "p-current-1", color: "#5b8cff", x: 18, y: 15, spread: 75, opacity: 0.40, enabled: true },
      { id: "p-current-2", color: "#8da9dc", x: 82, y: 22, spread: 70, opacity: 0.32, enabled: true },
      { id: "p-current-3", color: "#3b5998", x: 48, y: 88, spread: 80, opacity: 0.30, enabled: true },
    ],
  },
  cool: {
    preset: "cool",
    points: [
      { id: "p-cool-1", color: "#0ea5e9", x: 15, y: 20, spread: 65, opacity: 0.42, enabled: true },
      { id: "p-cool-2", color: "#6366f1", x: 85, y: 25, spread: 70, opacity: 0.38, enabled: true },
      { id: "p-cool-3", color: "#3b82f6", x: 50, y: 85, spread: 75, opacity: 0.34, enabled: true },
      { id: "p-cool-4", color: "#8b5cf6", x: 20, y: 75, spread: 60, opacity: 0.32, enabled: true },
    ],
  },
  aurora: {
    preset: "aurora",
    points: [
      { id: "p-aurora-1", color: "#10b981", x: 20, y: 20, spread: 70, opacity: 0.38, enabled: true },
      { id: "p-aurora-2", color: "#06b6d4", x: 80, y: 15, spread: 75, opacity: 0.38, enabled: true },
      { id: "p-aurora-3", color: "#8b5cf6", x: 75, y: 85, spread: 65, opacity: 0.34, enabled: true },
      { id: "p-aurora-4", color: "#14b8a6", x: 25, y: 80, spread: 65, opacity: 0.32, enabled: true },
    ],
  },
  warm: {
    preset: "warm",
    points: [
      { id: "p-warm-1", color: "#f59e0b", x: 25, y: 15, spread: 70, opacity: 0.38, enabled: true },
      { id: "p-warm-2", color: "#f43f5e", x: 85, y: 25, spread: 65, opacity: 0.36, enabled: true },
      { id: "p-warm-3", color: "#ec4899", x: 40, y: 85, spread: 70, opacity: 0.32, enabled: true },
      { id: "p-warm-4", color: "#fb923c", x: 80, y: 80, spread: 60, opacity: 0.34, enabled: true },
    ],
  },
  neutral: {
    preset: "neutral",
    points: [
      { id: "p-neutral-1", color: "#64748b", x: 20, y: 20, spread: 75, opacity: 0.38, enabled: true },
      { id: "p-neutral-2", color: "#94a3b8", x: 80, y: 30, spread: 65, opacity: 0.34, enabled: true },
      { id: "p-neutral-3", color: "#475569", x: 45, y: 80, spread: 75, opacity: 0.36, enabled: true },
    ],
  },
};

export function getDefaultGradientConfig(): GradientConfig {
  return structuredClone(GRADIENT_PRESETS.current);
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const num = Number.parseInt(clean, 16);
  if (Number.isNaN(num) || clean.length !== 6) {
    return `rgba(91, 140, 255, ${alpha.toFixed(2)})`;
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(2)})`;
}

function hslToHex(h: number, s: number, l: number): string {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r: number;
  let g: number;
  let b: number;

  if (hNorm < 60) { r = c; g = x; b = 0; }
  else if (hNorm < 120) { r = x; g = c; b = 0; }
  else if (hNorm < 180) { r = 0; g = c; b = x; }
  else if (hNorm < 240) { r = 0; g = x; b = c; }
  else if (hNorm < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (val: number): string => Math.round((val + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Compiles a GradientConfig into native layered CSS radial gradients.
 */
export function compileGradientCss(
  gradient: GradientConfig | null | undefined,
  dark = true,
  performanceMode: ResolvedPerformanceMode = "quality",
): string {
  const config = gradient ?? GRADIENT_PRESETS.current;
  let activePoints = (config.points || []).filter((p) => p.enabled);

  if (activePoints.length === 0) return "none";

  // In software mode, cap to top 3 points for maximum responsiveness
  if (performanceMode === "software" && activePoints.length > 3) {
    activePoints = activePoints.slice(0, 3);
  }

  const layers = activePoints.map((point) => {
    const opacity = point.opacity ?? (dark ? 0.35 : 0.28);
    const spread = Math.round(point.spread ?? 65);
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const rgba = hexToRgba(point.color, opacity);
    return `radial-gradient(circle at ${x}% ${y}%, ${rgba} 0%, transparent ${spread}%)`;
  });

  return layers.join(", ");
}

/**
 * Curated spatial distribution anchors preventing random points from bunching up.
 */
const SPATIAL_REGIONS = [
  { minX: 10, maxX: 30, minY: 10, maxY: 30 }, // Top-Left
  { minX: 70, maxX: 90, minY: 10, maxY: 30 }, // Top-Right
  { minX: 35, maxX: 65, minY: 70, maxY: 90 }, // Bottom-Center
  { minX: 10, maxX: 30, minY: 65, maxY: 85 }, // Bottom-Left
  { minX: 70, maxX: 90, minY: 65, maxY: 85 }, // Bottom-Right
  { minX: 35, maxX: 65, minY: 20, maxY: 45 }, // Upper-Center
  { minX: 5, maxX: 20, minY: 40, maxY: 60 },  // Mid-Left
  { minX: 80, maxX: 95, minY: 40, maxY: 60 }, // Mid-Right
  { minX: 40, maxX: 60, minY: 45, maxY: 60 }, // Center
  { minX: 20, maxX: 40, minY: 80, maxY: 95 }, // Lower-Left-Center
] as const;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a curated, aesthetically balanced random multi-point gradient.
 * Employs color theory (analogous, triadic, complementary) and spatial dispersion.
 */
export function generateRandomCuratedGradient(dark = true, count?: number): GradientConfig {
  const targetCount = Math.max(2, Math.min(10, count ?? rand(3, 5)));

  // Harmonic color strategy
  const strategies = ["analogous", "triadic", "split-complementary", "oceanic", "sunset"] as const;
  const strategy = strategies[rand(0, strategies.length - 1)]!;

  const baseHue = rand(0, 359);
  const hues: number[] = [];

  for (let i = 0; i < targetCount; i += 1) {
    if (strategy === "analogous") {
      hues.push((baseHue + (i * 28 - (targetCount * 14))) % 360);
    } else if (strategy === "triadic") {
      hues.push((baseHue + (i % 3) * 120 + rand(-15, 15)) % 360);
    } else if (strategy === "split-complementary") {
      const step = i === 0 ? 0 : i % 2 === 1 ? 150 : 210;
      hues.push((baseHue + step + rand(-10, 10)) % 360);
    } else if (strategy === "oceanic") {
      // 170 to 240 (teal, cyan, blue, deep cobalt)
      hues.push((170 + ((i * 22) % 80) + rand(-8, 8)) % 360);
    } else {
      // sunset: 340 to 45 (rose, crimson, coral, amber)
      hues.push((340 + ((i * 25) % 80) + rand(-8, 8)) % 360);
    }
  }

  // Shuffle spatial regions
  const shuffledRegions = [...SPATIAL_REGIONS].sort(() => Math.random() - 0.5);

  const points: GradientPoint[] = [];

  for (let i = 0; i < targetCount; i += 1) {
    const region = shuffledRegions[i % shuffledRegions.length]!;
    const hue = hues[i]!;
    // Saturation bounded between 48% and 75% for rich, non-muddy, non-neon colors
    const saturation = rand(50, 75);
    // Lightness tailored to canvas mode to ensure glass card readability
    const lightness = dark ? rand(46, 62) : rand(55, 72);
    const color = hslToHex(hue, saturation, lightness);

    const x = rand(region.minX, region.maxX);
    const y = rand(region.minY, region.maxY);
    const spread = rand(55, 80);
    const opacity = dark ? (rand(28, 42) / 100) : (rand(22, 35) / 100);

    points.push({
      id: `p-rand-${i + 1}-${Date.now().toString(36).slice(-4)}`,
      color,
      x,
      y,
      spread,
      opacity,
      enabled: true,
    });
  }

  return {
    preset: "custom",
    points,
  };
}
