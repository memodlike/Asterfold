import type { CSSProperties } from "react";
import type { ThemeConfig } from "../../domain/models";
import type { ResolvedPerformanceMode } from "../performance/performanceProfile";
import { semanticPalette } from "./semanticPalette";

export const BUILTIN_WALLPAPERS = [
  { id: "builtin-aurora", labelKey: "settings.wallpaperAurora", value: 'url("/wallpapers/quiet-aurora.webp")', compatibilityValue: 'url("/wallpapers/quiet-aurora-compat.webp")' },
  { id: "builtin-mesh", labelKey: "settings.wallpaperMesh", value: 'url("/wallpapers/blue-mesh.webp")', compatibilityValue: 'url("/wallpapers/blue-mesh-compat.webp")' },
  { id: "builtin-dusk", labelKey: "settings.wallpaperDusk", value: 'url("/wallpapers/dusk.webp")', compatibilityValue: 'url("/wallpapers/dusk-compat.webp")' },
] as const;

export function themeStyle(
  theme: ThemeConfig,
  wallpaperUrl: string | null,
  compatibilityWallpaperOrDark: string | null | boolean,
  darkValue?: boolean,
  performanceMode: ResolvedPerformanceMode = "quality",
): CSSProperties {
  const legacyCall = typeof compatibilityWallpaperOrDark === "boolean";
  const compatibilityWallpaperUrl = legacyCall ? wallpaperUrl : compatibilityWallpaperOrDark;
  const dark = legacyCall ? compatibilityWallpaperOrDark : darkValue ?? false;
  const palette = semanticPalette(dark);
  const builtin = BUILTIN_WALLPAPERS.find((item) => item.id === theme.wallpaperId);
  const wallpaperImage = theme.backgroundMode === "wallpaper" ? wallpaperUrl ? `url("${wallpaperUrl}")` : builtin?.value ?? "none" : "none";
  const compatibilityImage = theme.backgroundMode === "wallpaper"
    ? wallpaperUrl ? wallpaperImage : builtin?.compatibilityValue ?? wallpaperImage
    : "none";
  const softwareImage = theme.backgroundMode === "wallpaper"
    ? compatibilityWallpaperUrl ? `url("${compatibilityWallpaperUrl}")` : builtin?.compatibilityValue ?? compatibilityImage
    : "none";
  const canvas = theme.backgroundMode === "solid" ? theme.canvas : palette.canvas;
  const wallpaperFilter = performanceMode === "quality" && (theme.wallpaperBlur > 0 || theme.wallpaperSaturation !== 1)
    ? `blur(${theme.wallpaperBlur}px) saturate(${theme.wallpaperSaturation})`
    : "none";
  const wallpaperTransform = performanceMode === "quality" && wallpaperImage !== "none" && theme.wallpaperZoom > 1 ? `scale(${theme.wallpaperZoom})` : "none";
  return {
    "--color-canvas": canvas, "--surface-rgb": palette.surface, "--color-surface": `rgb(${palette.surface} / ${theme.surfaceOpacity})`, "--surface-opacity": theme.surfaceOpacity,
    "--color-surface-solid": palette.surfaceSolid, "--color-surface-elevated": palette.surfaceElevated, "--color-text": palette.text, "--color-text-secondary": palette.secondary,
    "--border-rgb": palette.border, "--color-border": `rgb(${palette.border} / ${dark ? ".15" : ".10"})`, "--color-accent": theme.accent, "--color-danger": palette.danger,
    "--color-success": palette.success, "--shadow-panel": palette.shadow, "--glass-blur": `${Math.min(32, theme.blur)}px`,
    "--glass-highlight": dark ? "rgb(255 255 255 / .14)" : "rgb(255 255 255 / .70)", "--glass-sheen": theme.glassVariant === "clear" ? ".09" : ".18",
    "--radius-card": `${theme.radius}px`, "--font-scale": theme.fontScale, "--board-width": `${theme.boardWidth}px`, "--favicon-size": `${theme.faviconSize}px`,
    "--bookmark-row-height": theme.density === "compact" ? "18px" : theme.density === "spacious" ? "22px" : "20px",
    "--wallpaper-image": wallpaperImage, "--wallpaper-compat-image": compatibilityImage, "--wallpaper-software-image": softwareImage, "--wallpaper-dim": wallpaperImage === "none" ? 0 : theme.wallpaperDim,
    "--wallpaper-filter": wallpaperFilter, "--wallpaper-position": theme.wallpaperPosition, "--wallpaper-transform": wallpaperTransform,
    "--density-space": theme.density === "compact" ? "8px" : theme.density === "spacious" ? "16px" : "12px",
  } as CSSProperties;
}

export function isDarkTheme(theme: ThemeConfig): boolean {
  return theme.mode === "dark" || (theme.mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}
