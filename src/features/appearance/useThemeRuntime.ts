import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../db/database";
import type { ThemeConfig } from "../../domain/models";
import { browserPerformanceSignals, classifyPerformanceMode, type ResolvedPerformanceMode } from "../performance/performanceProfile";
import { themeStyle } from "./themeRuntime";

interface WallpaperUrls { normal: string | null; compatibility: string | null }

export function useThemeRuntime(theme: ThemeConfig | undefined): ResolvedPerformanceMode {
  const [wallpaperUrls, setWallpaperUrls] = useState<WallpaperUrls>({ normal: null, compatibility: null });
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const signals = useMemo(browserPerformanceSignals, []);
  const previousVariables = useRef(new Map<string, string>());
  const performanceMode = useMemo(() => theme
    ? classifyPerformanceMode(theme.performanceMode, theme.lowPowerMode, signals)
    : "quality", [signals, theme]);

  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = (): void => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    if (!theme?.wallpaperId || theme.wallpaperId.startsWith("builtin-")) {
      setWallpaperUrls({ normal: null, compatibility: null });
      return;
    }
    void db.wallpapers.get(theme.wallpaperId).then((record) => {
      if (!active) return;
      const normal = record?.blob ? URL.createObjectURL(record.blob) : null;
      const compatibility = record?.thumbnail ? URL.createObjectURL(record.thumbnail) : normal;
      if (normal) objectUrls.push(normal);
      if (compatibility && compatibility !== normal) objectUrls.push(compatibility);
      setWallpaperUrls({ normal, compatibility });
    }).catch(() => { if (active) setWallpaperUrls({ normal: null, compatibility: null }); });
    return () => { active = false; for (const url of objectUrls) URL.revokeObjectURL(url); };
  }, [theme?.wallpaperId]);

  useEffect(() => {
    if (!theme) return;
    const dark = theme.mode === "dark" || (theme.mode === "system" && systemDark);
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.performance = performanceMode;
    root.style.colorScheme = dark ? "dark" : "light";
  }, [performanceMode, systemDark, theme]);

  const style = useMemo(() => theme ? themeStyle(
    theme, wallpaperUrls.normal, wallpaperUrls.compatibility,
    theme.mode === "dark" || (theme.mode === "system" && systemDark), performanceMode,
  ) : undefined, [performanceMode, systemDark, theme, wallpaperUrls]);

  useEffect(() => {
    if (!style) return;
    const root = document.documentElement;
    const next = new Map<string, string>();
    for (const [name, rawValue] of Object.entries(style)) {
      if (!name.startsWith("--") || rawValue === undefined) continue;
      const value = String(rawValue);
      next.set(name, value);
      if (previousVariables.current.get(name) !== value) root.style.setProperty(name, value);
    }
    for (const name of previousVariables.current.keys()) if (!next.has(name)) root.style.removeProperty(name);
    previousVariables.current = next;
  }, [style]);

  useEffect(() => () => {
    const root = document.documentElement;
    for (const name of previousVariables.current.keys()) root.style.removeProperty(name);
    previousVariables.current.clear();
    delete root.dataset.performance;
  }, []);

  return performanceMode;
}
