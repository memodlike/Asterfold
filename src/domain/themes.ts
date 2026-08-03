import type { ThemeConfig, ThemePresetId } from "./models";
import { themeSchema } from "./schemas";

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
  performanceMode: "auto",
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
  const source = theme as unknown as Record<string, unknown>;
  const enumValue = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => (
    typeof value === "string" && values.includes(value as T) ? value as T : fallback
  );
  const finiteNumber = (value: unknown, fallback: number, minimum: number, maximum: number): number => (
    typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback
  );
  const booleanValue = (value: unknown, fallback: boolean): boolean => typeof value === "boolean" ? value : fallback;
  const preset = enumValue(source.preset, THEME_PRESETS.map((item) => item.id), "frost-light");
  const fallback = getThemePreset(preset);
  const candidate: ThemeConfig = {
    preset,
    mode: enumValue(source.mode, ["system", "light", "dark"], fallback.mode),
    accent: typeof source.accent === "string" && isValidHexColor(source.accent) ? source.accent : fallback.accent,
    canvas: typeof source.canvas === "string" && isValidHexColor(source.canvas) ? source.canvas : fallback.canvas,
    surfaceOpacity: finiteNumber(source.surfaceOpacity, fallback.surfaceOpacity, 0.2, 1),
    blur: finiteNumber(source.blur, fallback.blur, 0, 32),
    radius: finiteNumber(source.radius, fallback.radius, 4, 28),
    density: enumValue(source.density, ["compact", "comfortable", "spacious"], fallback.density),
    fontScale: finiteNumber(source.fontScale, fallback.fontScale, 0.9, 1.25),
    boardWidth: finiteNumber(source.boardWidth, fallback.boardWidth, 280, 520),
    cardVariant: enumValue(source.cardVariant, ["minimal", "standard", "visual"], fallback.cardVariant),
    showHostname: booleanValue(source.showHostname, fallback.showHostname),
    showDescription: booleanValue(source.showDescription, fallback.showDescription),
    faviconSize: finiteNumber(source.faviconSize, fallback.faviconSize, 20, 48),
    motion: booleanValue(source.motion, fallback.motion),
    performanceMode: enumValue(source.performanceMode, ["auto", "quality", "compatibility"], fallback.performanceMode),
    lowPowerMode: booleanValue(source.lowPowerMode, fallback.lowPowerMode),
    bookmarkHoverMotion: booleanValue(source.bookmarkHoverMotion, fallback.bookmarkHoverMotion),
    menuMotion: booleanValue(source.menuMotion, fallback.menuMotion),
    dragMotion: booleanValue(source.dragMotion, fallback.dragMotion),
    wallpaperId: source.wallpaperId === null || (typeof source.wallpaperId === "string" && source.wallpaperId.length <= 128)
      ? source.wallpaperId
      : fallback.wallpaperId,
    wallpaperDim: finiteNumber(source.wallpaperDim, fallback.wallpaperDim, 0, 0.8),
    wallpaperBlur: finiteNumber(source.wallpaperBlur, fallback.wallpaperBlur, 0, 30),
    wallpaperSaturation: finiteNumber(source.wallpaperSaturation, fallback.wallpaperSaturation, 0, 1.8),
    wallpaperPosition: typeof source.wallpaperPosition === "string" && source.wallpaperPosition.length <= 64
      ? source.wallpaperPosition
      : fallback.wallpaperPosition,
    wallpaperZoom: finiteNumber(source.wallpaperZoom, fallback.wallpaperZoom, 1, 2),
    glassVariant: enumValue(source.glassVariant, ["regular", "clear"], fallback.glassVariant),
    backgroundMode: enumValue(source.backgroundMode, ["auto", "solid", "wallpaper"], fallback.backgroundMode),
  };
  return themeSchema.parse(candidate);
}
