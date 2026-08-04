export const STARTUP_SNAPSHOT_KEY = "asterfold:startup-theme:v1";

export interface StartupThemeSnapshot {
  version: 1;
  theme: "light" | "dark";
  canvas: string;
  wallpaper: string;
}

const SAFE_CANVAS = /^#[0-9a-f]{6}$/i;
const SAFE_WALLPAPER = /^url\(["']?\/wallpapers\/(?:quiet-aurora|blue-mesh|dusk)(?:-compat)?\.webp["']?\)$/i;

export function parseStartupThemeSnapshot(raw: string | null): StartupThemeSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StartupThemeSnapshot>;
    if (value.version !== 1 || (value.theme !== "light" && value.theme !== "dark")) return null;
    if (typeof value.canvas !== "string" || !SAFE_CANVAS.test(value.canvas)) return null;
    const wallpaper = typeof value.wallpaper === "string" && SAFE_WALLPAPER.test(value.wallpaper) ? value.wallpaper : "none";
    return { version: 1, theme: value.theme, canvas: value.canvas, wallpaper };
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
  root.style.colorScheme = snapshot.theme;
  root.style.setProperty("--startup-canvas", snapshot.canvas);
  root.style.setProperty("--startup-wallpaper", snapshot.wallpaper);
}

export function storeStartupThemeSnapshot(
  dark: boolean,
  style: Record<string, unknown>,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  const rawCanvas = String(style["--color-canvas"] ?? "");
  const canvas = SAFE_CANVAS.test(rawCanvas) ? rawCanvas : dark ? "#16171a" : "#f1f2f4";
  const rawWallpaper = String(style["--wallpaper-image"] ?? "none");
  const wallpaper = SAFE_WALLPAPER.test(rawWallpaper) ? rawWallpaper : "none";
  const snapshot: StartupThemeSnapshot = { version: 1, theme: dark ? "dark" : "light", canvas, wallpaper };
  try {
    storage.setItem(STARTUP_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Startup persistence is a visual optimization only; storage denial must never block the app.
  }
}

export function extractCssImageUrl(value: unknown): string | null {
  const match = /^url\(["']?(.*?)["']?\)$/.exec(String(value ?? "").trim());
  return match?.[1] || null;
}
