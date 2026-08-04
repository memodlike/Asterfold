import type { ThemeConfig } from "../../domain/models";

export const THEME_PREVIEW_EVENT = "asterfold:theme-preview";

export function publishThemePreview(theme: ThemeConfig | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ThemeConfig | null>(THEME_PREVIEW_EVENT, { detail: theme }));
}

export function themePreviewFromEvent(event: Event): ThemeConfig | null {
  return (event as CustomEvent<ThemeConfig | null>).detail ?? null;
}
