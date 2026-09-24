import type { ResolvedPerformanceMode } from "../performance/performanceProfile";

export const STARTUP_SNAPSHOT_KEY = "asterfold:startup-theme:v1";

const PERFORMANCE_TIERS: readonly ResolvedPerformanceMode[] = ["quality", "balanced", "compatibility", "software"];

export interface StartupThemeSnapshot {
  version: 1 | 2 | 3;
  theme: "light" | "dark";
  canvas: string;
  wallpaper: string;
  motion: boolean;
  /** Rendering tier of the previous session, applied before first paint (v3+). */
  performance?: ResolvedPerformanceMode;
}

const SAFE_CANVAS = /^#[0-9a-f]{6}$/i;
const SAFE_WALLPAPER = /^url\(["']?\/wallpapers\/(?:quiet-aurora|blue-mesh|dusk)(?:-compat)?\.webp["']?\)$/i;

function stringStyleValue(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function parseStartupThemeSnapshot(raw: string | null): StartupThemeSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StartupThemeSnapshot>;
    if ((value.version !== 1 && value.version !== 2 && value.version !== 3) || (value.theme !== "light" && value.theme !== "dark")) return null;
    if (typeof value.canvas !== "string" || !SAFE_CANVAS.test(value.canvas)) return null;
    const wallpaper = typeof value.wallpaper === "string" && SAFE_WALLPAPER.test(value.wallpaper) ? value.wallpaper : "none";
    const motion = value.version >= 2 ? value.motion !== false : true;
    const snapshot: StartupThemeSnapshot = { version: value.version, theme: value.theme, canvas: value.canvas, wallpaper, motion };
    if (value.version === 3 && value.performance && PERFORMANCE_TIERS.includes(value.performance)) snapshot.performance = value.performance;
    return snapshot;
  } catch {
    return null;
  }
}

export function readStartupThemeSnapshot(storage: Pick<Storage, "getItem"> = localStorage): StartupThemeSnapshot | null {
  try {
    return parseStartupThemeSnapshot(storage.getItem(STARTUP_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export function applyStartupThemeSnapshot(root: HTMLElement, snapshot: StartupThemeSnapshot): void {
  root.dataset.theme = snapshot.theme;
  root.dataset.asterfoldMotion = snapshot.motion ? "on" : "off";
  if (snapshot.performance) root.dataset.performance = snapshot.performance;
  root.style.colorScheme = snapshot.theme;
  root.style.setProperty("--startup-canvas", snapshot.canvas);
  root.style.setProperty("--startup-wallpaper", snapshot.wallpaper);
}

export function storeStartupThemeSnapshot(
  dark: boolean,
  style: Record<string, unknown>,
  storage: Pick<Storage, "setItem"> = localStorage,
  motion = true,
  performance: ResolvedPerformanceMode = "quality",
): void {
  const rawCanvas = stringStyleValue(style["--color-canvas"], "");
  const canvas = SAFE_CANVAS.test(rawCanvas) ? rawCanvas : dark ? "#16171a" : "#f1f2f4";
  const rawWallpaper = stringStyleValue(style["--wallpaper-image"], "none");
  const wallpaper = SAFE_WALLPAPER.test(rawWallpaper) ? rawWallpaper : "none";
  const snapshot: StartupThemeSnapshot = { version: 3, theme: dark ? "dark" : "light", canvas, wallpaper, motion, performance };
  try {
    storage.setItem(STARTUP_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Startup persistence is a visual optimization only; storage denial must never block the app.
  }
}

export function extractCssImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^url\(["']?(.*?)["']?\)$/.exec(value.trim());
  return match?.[1] || null;
}
