import type { ThemeConfig } from "../../domain/models";
import { semanticPalette } from "./semanticPalette";

export function isPopupDark(theme: ThemeConfig, systemDark: boolean): boolean {
  return theme.mode === "dark" || (theme.mode === "system" && systemDark);
}

export function applyPopupTheme(root: HTMLElement, theme: ThemeConfig, systemDark: boolean): void {
  const dark = isPopupDark(theme, systemDark);
  const palette = semanticPalette(dark);
  const border = `rgb(${palette.border} / ${dark ? ".15" : ".10"})`;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  const variables: Record<string, string> = {
    "--color-canvas": palette.canvas,
    "--color-surface-solid": palette.surfaceSolid,
    "--color-surface-elevated": palette.surfaceElevated,
    "--color-text": palette.text,
    "--color-text-secondary": palette.secondary,
    "--border-rgb": palette.border,
    "--color-border": border,
    "--color-accent": theme.accent,
    "--color-danger": palette.danger,
    "--color-success": palette.success,
    "--popup-canvas": palette.canvas,
    "--popup-surface": palette.surfaceElevated,
    "--popup-surface-low": palette.surfaceSolid,
    "--popup-text": palette.text,
    "--popup-text-secondary": palette.secondary,
    "--popup-border": border,
    "--popup-accent": theme.accent,
    "--popup-danger": palette.danger,
    "--popup-success": palette.success,
  };
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
}
