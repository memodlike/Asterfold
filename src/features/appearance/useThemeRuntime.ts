import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { db } from "../../db/database";
import type { ThemeConfig } from "../../domain/models";
import { browserPerformanceSignals, classifyPerformanceMode, type ResolvedPerformanceMode } from "../performance/performanceProfile";
import { extractCssImageUrl, storeStartupThemeSnapshot } from "./startupSnapshot";
import { themeStyle } from "./themeRuntime";

interface WallpaperUrls {
  normal: string | null;
  compatibility: string | null;
  resolved: boolean;
  sourceId: string | null;
}

function isUploadedWallpaper(id: string | null | undefined): id is string {
  return Boolean(id && !id.startsWith("builtin-"));
}

async function waitForWallpaperAsset(cssValue: unknown): Promise<void> {
  const url = extractCssImageUrl(cssValue);
  if (!url || typeof Image === "undefined") return;
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  if (typeof image.decode !== "function") return;
  await Promise.race([
    image.decode().catch(() => undefined),
    new Promise<void>((resolvePromise) => window.setTimeout(resolvePromise, 650)),
  ]);
}

function nextFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(() => callback());
  return window.setTimeout(callback, 0);
}

export function useThemeRuntime(theme: ThemeConfig | undefined): ResolvedPerformanceMode {
  const [wallpaperUrls, setWallpaperUrls] = useState<WallpaperUrls>(() => ({
    normal: null,
    compatibility: null,
    resolved: !isUploadedWallpaper(theme?.wallpaperId),
    sourceId: theme?.wallpaperId ?? null,
  }));
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const signals = useMemo(() => browserPerformanceSignals(), []);
  const previousVariables = useRef(new Map<string, string>());
  const revealTimer = useRef<number | null>(null);
  const performanceMode = useMemo(() => theme
    ? classifyPerformanceMode(theme.performanceMode, theme.lowPowerMode, signals)
    : "quality", [signals, theme]);
  const dark = Boolean(theme && (theme.mode === "dark" || (theme.mode === "system" && systemDark)));

  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = (): void => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const wallpaperId = theme?.wallpaperId ?? null;
    if (!isUploadedWallpaper(wallpaperId)) {
      setWallpaperUrls({ normal: null, compatibility: null, resolved: true, sourceId: wallpaperId });
      return;
    }
    setWallpaperUrls({ normal: null, compatibility: null, resolved: false, sourceId: wallpaperId });
    void db.wallpapers.get(wallpaperId).then((record) => {
      if (!active) return;
      const normal = record?.blob ? URL.createObjectURL(record.blob) : null;
      const compatibility = record?.thumbnail ? URL.createObjectURL(record.thumbnail) : normal;
      if (normal) objectUrls.push(normal);
      if (compatibility && compatibility !== normal) objectUrls.push(compatibility);
      setWallpaperUrls({ normal, compatibility, resolved: true, sourceId: wallpaperId });
    }).catch(() => {
      if (active) setWallpaperUrls({ normal: null, compatibility: null, resolved: true, sourceId: wallpaperId });
    });
    return () => {
      active = false;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [theme?.wallpaperId]);

  const style = useMemo(() => theme ? themeStyle(
    theme, wallpaperUrls.normal, wallpaperUrls.compatibility,
    dark, performanceMode,
  ) : undefined, [dark, performanceMode, theme, wallpaperUrls.compatibility, wallpaperUrls.normal]);

  useLayoutEffect(() => {
    if (!theme || !style) return;
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.performance = performanceMode;
    root.style.colorScheme = dark ? "dark" : "light";
    const next = new Map<string, string>();
    for (const [name, rawValue] of Object.entries(style)) {
      if (!name.startsWith("--") || rawValue === undefined) continue;
      const value = String(rawValue);
      next.set(name, value);
      if (previousVariables.current.get(name) !== value) root.style.setProperty(name, value);
    }
    for (const name of previousVariables.current.keys()) if (!next.has(name)) root.style.removeProperty(name);
    previousVariables.current = next;
  }, [dark, performanceMode, style, theme]);

  useEffect(() => {
    if (!theme || !style || !wallpaperUrls.resolved || wallpaperUrls.sourceId !== (theme.wallpaperId ?? null)) return;
    let active = true;
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    const root = document.documentElement;
    storeStartupThemeSnapshot(dark, style as Record<string, unknown>);
    if (root.dataset.asterfoldReady === "true") return;

    void Promise.all([
      waitForWallpaperAsset(style["--wallpaper-image" as keyof typeof style]),
      document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve(),
    ]).then(() => {
      if (!active) return;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (theme.motion && !reducedMotion) root.dataset.asterfoldEntering = "true";
      else delete root.dataset.asterfoldEntering;
      firstFrame = nextFrame(() => {
        secondFrame = nextFrame(() => {
          if (!active) return;
          root.dataset.asterfoldReady = "true";
          root.dataset.asterfoldBoot = "ready";
          window.dispatchEvent(new Event("asterfold:ready"));
          performance.mark("asterfold-visual-ready");
          if (root.dataset.asterfoldEntering === "true") {
            revealTimer.current = window.setTimeout(() => {
              delete root.dataset.asterfoldEntering;
              revealTimer.current = null;
            }, 900);
          }
        });
      });
    });

    return () => {
      active = false;
      if (firstFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(firstFrame);
      if (secondFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(secondFrame);
    };
  }, [dark, style, theme, wallpaperUrls.resolved, wallpaperUrls.sourceId]);

  useEffect(() => () => {
    const root = document.documentElement;
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    for (const name of previousVariables.current.keys()) root.style.removeProperty(name);
    previousVariables.current.clear();
    delete root.dataset.performance;
  }, []);

  return performanceMode;
}
