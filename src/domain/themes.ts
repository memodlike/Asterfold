import type { ThemeConfig, ThemePresetId } from "./models";

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  config: ThemeConfig;
}

const base: Omit<ThemeConfig, "preset" | "mode" | "accent" | "canvas"> = {
  surfaceOpacity: 0.82,
  blur: 20,
  radius: 14,
  density: "comfortable",
  fontScale: 1,
  boardWidth: 360,
  cardVariant: "standard",
  showHostname: true,
  showDescription: true,
  faviconSize: 32,
  motion: true,
  lowPowerMode: false,
  bookmarkHoverMotion: true,
  menuMotion: true,
  dragMotion: true,
  wallpaperId: null,
  wallpaperDim: 0.2,
  wallpaperBlur: 0,
  wallpaperSaturation: 1,
  wallpaperPosition: "center",
  wallpaperZoom: 1,
  glassVariant: "regular",
  backgroundMode: "auto",
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: "frost-light", name: "Frost Light", config: { ...base, preset: "frost-light", mode: "light", accent: "#155eef", canvas: "#f5f7fb" } },
  { id: "graphite-dark", name: "Graphite Dark", config: { ...base, preset: "graphite-dark", mode: "dark", accent: "#5b8cff", canvas: "#0d1117", surfaceOpacity: 0.74 } },
  { id: "midnight", name: "Midnight", config: { ...base, preset: "midnight", mode: "dark", accent: "#7aa2ff", canvas: "#071124", surfaceOpacity: 0.78 } },
  { id: "aurora", name: "Aurora", config: { ...base, preset: "aurora", mode: "dark", accent: "#9b8cff", canvas: "#0a1230", surfaceOpacity: 0.64, blur: 24, wallpaperId: "builtin-aurora", wallpaperDim: 0.28 } },
  { id: "warm-paper", name: "Warm Paper", config: { ...base, preset: "warm-paper", mode: "light", accent: "#a24c22", canvas: "#f6f0e6", surfaceOpacity: 0.92, blur: 8, radius: 10 } },
  { id: "high-contrast", name: "High Contrast", config: { ...base, preset: "high-contrast", mode: "dark", accent: "#ffd84d", canvas: "#000000", surfaceOpacity: 1, blur: 0, radius: 8, fontScale: 1.05 } },
] as const;

export function getThemePreset(id: ThemePresetId): ThemeConfig {
  const preset = THEME_PRESETS.find((item) => item.id === id);
  return structuredClone(preset?.config ?? THEME_PRESETS[0]!.config);
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function validateTheme(theme: ThemeConfig): ThemeConfig {
  return {
    ...theme,
    accent: isValidHexColor(theme.accent) ? theme.accent : "#155eef",
    canvas: isValidHexColor(theme.canvas) ? theme.canvas : "#f5f7fb",
    surfaceOpacity: Math.min(1, Math.max(0.2, theme.surfaceOpacity)),
    blur: Math.min(32, Math.max(0, theme.blur)),
    radius: Math.min(28, Math.max(4, theme.radius)),
    fontScale: Math.min(1.25, Math.max(0.9, theme.fontScale)),
    boardWidth: Math.min(520, Math.max(280, theme.boardWidth)),
    faviconSize: Math.min(48, Math.max(20, theme.faviconSize)),
    wallpaperDim: Math.min(0.8, Math.max(0, theme.wallpaperDim)),
    wallpaperBlur: Math.min(30, Math.max(0, theme.wallpaperBlur)),
    wallpaperSaturation: Math.min(1.8, Math.max(0, theme.wallpaperSaturation)),
    wallpaperZoom: Math.min(2, Math.max(1, theme.wallpaperZoom)),
    lowPowerMode: theme.lowPowerMode,
    bookmarkHoverMotion: theme.bookmarkHoverMotion,
    menuMotion: theme.menuMotion,
    dragMotion: theme.dragMotion,
    glassVariant: theme.glassVariant === "clear" ? "clear" : "regular",
    backgroundMode: ["auto", "solid", "wallpaper"].includes(theme.backgroundMode) ? theme.backgroundMode : "auto",
  };
}
