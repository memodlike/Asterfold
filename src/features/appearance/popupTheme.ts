import type { ThemeConfig } from "../../domain/models";
import { automaticAccent, onAccentColor, readableAccent } from "./accent";
import { semanticPalette } from "./semanticPalette";

export function isPopupDark(theme: ThemeConfig, systemDark: boolean): boolean {
  return theme.mode === "dark" || (theme.mode === "system" && systemDark);
}

export function applyPopupTheme(root: HTMLElement, theme: ThemeConfig, systemDark: boolean): void {
  const dark = isPopupDark(theme, systemDark);
  const palette = semanticPalette(dark);
  const border = `rgb(${palette.border} / ${dark ? ".15" : ".10"})`;
  const accent = readableAccent(theme.accentMode === "custom" ? theme.accent : automaticAccent(theme) ?? theme.accent, dark);
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
    "--surface-rgb": palette.surface,
    "--color-accent": accent,
    "--color-on-accent": onAccentColor(accent),
    "--color-danger": palette.danger,
    "--color-success": palette.success,
  };
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
}
