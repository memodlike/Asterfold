import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/database";
import type { ThemeConfig, Wallpaper } from "../../domain/models";
import { isDarkTheme, themeStyle } from "./themeRuntime";

export function useThemeRuntime(theme: ThemeConfig | undefined) {
  const [wallpaper, setWallpaper] = useState<Wallpaper>();
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!theme?.wallpaperId || theme.wallpaperId.startsWith("builtin-")) {
      setWallpaper(undefined);
      setWallpaperUrl(null);
      return;
    }
    void db.wallpapers.get(theme.wallpaperId).then((record) => {
      if (!active) return;
      setWallpaper(record);
      if (record?.blob) {
        objectUrl = URL.createObjectURL(record.blob);
        setWallpaperUrl(objectUrl);
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [theme?.wallpaperId]);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme.preset;
    document.documentElement.style.colorScheme = isDarkTheme(theme) ? "dark" : "light";
  }, [theme]);

  return useMemo(() => theme ? themeStyle(theme, wallpaper, wallpaperUrl) : undefined, [theme, wallpaper, wallpaperUrl]);
}
