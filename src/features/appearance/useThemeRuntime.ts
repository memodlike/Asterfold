import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/database";
import type { ThemeConfig, Wallpaper } from "../../domain/models";
import { themeStyle } from "./themeRuntime";

export function useThemeRuntime(theme: ThemeConfig | undefined) {
  const [wallpaper, setWallpaper] = useState<Wallpaper>();
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = (): void => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
    const dark = theme.mode === "dark" || (theme.mode === "system" && systemDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [systemDark, theme]);

  const style = useMemo(
    () => theme ? themeStyle(theme, wallpaper, wallpaperUrl, theme.mode === "dark" || (theme.mode === "system" && systemDark)) : undefined,
    [systemDark, theme, wallpaper, wallpaperUrl],
  );

  useEffect(() => {
    if (!style) return;
    const root = document.documentElement;
    const variables = Object.entries(style).filter(([name, value]) => name.startsWith("--") && value !== undefined);
    for (const [name, value] of variables) root.style.setProperty(name, String(value));
    return () => {
      for (const [name] of variables) root.style.removeProperty(name);
    };
  }, [style]);

  return style;
}
