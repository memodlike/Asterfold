import type { CSSProperties } from "react";
import type { ThemeConfig, Wallpaper } from "../../domain/models";

interface Palette {
  canvas: string;
  surface: string;
  surfaceSolid: string;
  surfaceElevated: string;
  text: string;
  secondary: string;
  border: string;
  danger: string;
  success: string;
  shadow: string;
}

const lightPalette: Palette = { canvas: "#f1f2f4", surface: "255 255 255", surfaceSolid: "#fbfbfc", surfaceElevated: "#ffffff", text: "#191a1d", secondary: "#6e7077", border: "19 20 23", danger: "#c9342f", success: "#237c4b", shadow: "0 20px 55px rgb(20 22 28 / .12)" };
const darkPalette: Palette = { canvas: "#16171a", surface: "38 40 44", surfaceSolid: "#25272b", surfaceElevated: "#2d2f34", text: "#f5f5f6", secondary: "#a1a3aa", border: "255 255 255", danger: "#ff7772", success: "#64d79b", shadow: "0 24px 64px rgb(0 0 0 / .34)" };

export const BUILTIN_WALLPAPERS = [
  { id: "builtin-aurora", name: "Quiet Aurora", value: 'url("/wallpapers/quiet-aurora.webp")' },
  { id: "builtin-mesh", name: "Blue Mesh", value: 'url("/wallpapers/blue-mesh.webp")' },
  { id: "builtin-dusk", name: "Dusk", value: 'url("/wallpapers/dusk.webp")' },
] as const;

export function themeStyle(theme: ThemeConfig, wallpaper: Wallpaper | undefined, wallpaperUrl: string | null, dark: boolean): CSSProperties {
  const palette = dark ? darkPalette : lightPalette;
  const builtin = BUILTIN_WALLPAPERS.find((item) => item.id === theme.wallpaperId);
  const wallpaperImage = theme.backgroundMode === "wallpaper" ? wallpaperUrl ? `url("${wallpaperUrl}")` : builtin?.value ?? "none" : "none";
  const canvas = theme.backgroundMode === "solid" ? theme.canvas : palette.canvas;
  const wallpaperFilter = theme.wallpaperBlur > 0 || theme.wallpaperSaturation !== 1
    ? `blur(${theme.wallpaperBlur}px) saturate(${theme.wallpaperSaturation})`
    : "none";
  const wallpaperTransform = wallpaperImage !== "none" && theme.wallpaperZoom > 1
    ? `scale(${theme.wallpaperZoom})`
    : "none";
  return {
    "--color-canvas": canvas,
    "--surface-rgb": palette.surface,
    "--color-surface": `rgb(${palette.surface} / ${theme.surfaceOpacity})`,
    "--surface-opacity": theme.surfaceOpacity,
    "--color-surface-solid": palette.surfaceSolid,
    "--color-surface-elevated": palette.surfaceElevated,
    "--color-text": palette.text,
    "--color-text-secondary": palette.secondary,
    "--border-rgb": palette.border,
    "--color-border": `rgb(${palette.border} / ${dark ? ".15" : ".10"})`,
    "--color-accent": theme.accent,
    "--color-danger": palette.danger,
    "--color-success": palette.success,
    "--shadow-panel": palette.shadow,
    "--glass-blur": `${Math.min(32, theme.blur)}px`,
    "--glass-highlight": dark ? "rgb(255 255 255 / .14)" : "rgb(255 255 255 / .70)",
    "--glass-sheen": theme.glassVariant === "clear" ? ".09" : ".18",
    "--radius-card": `${theme.radius}px`,
    "--font-scale": theme.fontScale,
    "--board-width": `${theme.boardWidth}px`,
    "--favicon-size": `${theme.faviconSize}px`,
    "--wallpaper-image": wallpaperImage,
    "--wallpaper-dim": wallpaperImage === "none" ? 0 : theme.wallpaperDim,
    "--wallpaper-filter": wallpaperFilter,
    "--wallpaper-position": theme.wallpaperPosition,
    "--wallpaper-transform": wallpaperTransform,
    "--density-space": theme.density === "compact" ? "8px" : theme.density === "spacious" ? "16px" : "12px",
  } as CSSProperties;
}

export function isDarkTheme(theme: ThemeConfig): boolean {
  return theme.mode === "dark" || (theme.mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}
