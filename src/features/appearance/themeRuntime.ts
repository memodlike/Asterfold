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

const palettes: Record<ThemeConfig["preset"], Palette> = {
  "frost-light": { canvas: "#f5f7fb", surface: "255 255 255", surfaceSolid: "#ffffff", surfaceElevated: "#ffffff", text: "#141821", secondary: "#667085", border: "18 28 45", danger: "#d92d20", success: "#079455", shadow: "0 18px 48px rgb(16 24 40 / .12)" },
  "graphite-dark": { canvas: "#0d1117", surface: "20 26 35", surfaceSolid: "#141a23", surfaceElevated: "#19212c", text: "#f2f4f7", secondary: "#98a2b3", border: "235 240 248", danger: "#ff6b66", success: "#47d18c", shadow: "0 22px 60px rgb(0 0 0 / .34)" },
  midnight: { canvas: "#071124", surface: "12 28 52", surfaceSolid: "#0c1c34", surfaceElevated: "#112747", text: "#f3f6ff", secondary: "#a7b5ce", border: "219 230 255", danger: "#ff7772", success: "#4adea0", shadow: "0 24px 64px rgb(0 3 12 / .44)" },
  aurora: { canvas: "#08122e", surface: "16 28 62", surfaceSolid: "#111d3f", surfaceElevated: "#172752", text: "#f6f3ff", secondary: "#beb8d9", border: "225 220 255", danger: "#ff7a78", success: "#55e2a3", shadow: "0 28px 70px rgb(1 4 18 / .46)" },
  "warm-paper": { canvas: "#f6f0e6", surface: "255 252 246", surfaceSolid: "#fffaf2", surfaceElevated: "#fffdf9", text: "#27211b", secondary: "#776c60", border: "64 50 36", danger: "#bd342b", success: "#2f855a", shadow: "0 14px 38px rgb(63 45 24 / .12)" },
  "high-contrast": { canvas: "#000000", surface: "0 0 0", surfaceSolid: "#000000", surfaceElevated: "#101010", text: "#ffffff", secondary: "#ffffff", border: "255 255 255", danger: "#ff5c5c", success: "#64ff9e", shadow: "0 0 0 2px #ffffff" },
};

export const BUILTIN_WALLPAPERS = [
  { id: "builtin-aurora", name: "Quiet Aurora", value: 'url("/wallpapers/quiet-aurora.webp")' },
  { id: "builtin-mesh", name: "Blue Mesh", value: 'url("/wallpapers/blue-mesh.webp")' },
  { id: "builtin-dusk", name: "Dusk", value: 'url("/wallpapers/dusk.webp")' },
  { id: "builtin-paper", name: "Paper Grain", value: 'url("/wallpapers/paper-grain.webp")' },
] as const;

export function themeStyle(theme: ThemeConfig, wallpaper: Wallpaper | undefined, wallpaperUrl: string | null): CSSProperties {
  const palette = palettes[theme.preset];
  const builtin = BUILTIN_WALLPAPERS.find((item) => item.id === theme.wallpaperId);
  const wallpaperImage = wallpaperUrl ? `url("${wallpaperUrl}")` : builtin?.value ?? "none";
  return {
    "--color-canvas": theme.canvas || palette.canvas,
    "--surface-rgb": palette.surface,
    "--color-surface": `rgb(${palette.surface} / ${theme.surfaceOpacity})`,
    "--color-surface-solid": palette.surfaceSolid,
    "--color-surface-elevated": palette.surfaceElevated,
    "--color-text": palette.text,
    "--color-text-secondary": palette.secondary,
    "--border-rgb": palette.border,
    "--color-border": `rgb(${palette.border} / ${theme.preset === "high-contrast" ? ".72" : ".11"})`,
    "--color-accent": theme.accent,
    "--color-danger": palette.danger,
    "--color-success": palette.success,
    "--shadow-panel": palette.shadow,
    "--glass-blur": `${theme.blur}px`,
    "--radius-card": `${theme.radius}px`,
    "--font-scale": theme.fontScale,
    "--board-width": `${theme.boardWidth}px`,
    "--favicon-size": `${theme.faviconSize}px`,
    "--wallpaper-image": wallpaperImage,
    "--wallpaper-dim": wallpaperImage === "none" ? 0 : theme.wallpaperDim,
    "--wallpaper-blur": `${theme.wallpaperBlur}px`,
    "--wallpaper-saturation": theme.wallpaperSaturation,
    "--wallpaper-position": theme.wallpaperPosition,
    "--wallpaper-scale": theme.wallpaperZoom * 1.025,
    "--density-space": theme.density === "compact" ? "8px" : theme.density === "spacious" ? "16px" : "12px",
  } as CSSProperties;
}

export function isDarkTheme(theme: ThemeConfig): boolean {
  return theme.mode === "dark" || (theme.mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}
