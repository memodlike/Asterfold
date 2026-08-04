import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  STARTUP_SNAPSHOT_KEY,
  applyStartupThemeSnapshot,
  extractCssImageUrl,
  parseStartupThemeSnapshot,
  readStartupThemeSnapshot,
  storeStartupThemeSnapshot,
} from "../src/features/appearance/startupSnapshot";

describe("new-tab startup runtime", () => {
  afterEach(() => {
    localStorage.removeItem(STARTUP_SNAPSHOT_KEY);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("--startup-canvas");
    document.documentElement.style.removeProperty("--startup-wallpaper");
    document.documentElement.style.colorScheme = "";
  });

  it("accepts only versioned, bounded startup snapshots", () => {
    expect(parseStartupThemeSnapshot(JSON.stringify({ version: 1, theme: "dark", canvas: "#16171a", wallpaper: 'url("/wallpapers/dusk.webp")' }))).toEqual({
      version: 1,
      theme: "dark",
      canvas: "#16171a",
      wallpaper: 'url("/wallpapers/dusk.webp")',
    });
    expect(parseStartupThemeSnapshot("not-json")).toBeNull();
    expect(parseStartupThemeSnapshot(JSON.stringify({ version: 2, theme: "dark", canvas: "#16171a" }))).toBeNull();
    expect(parseStartupThemeSnapshot(JSON.stringify({ version: 1, theme: "dark", canvas: "white" }))).toBeNull();
    expect(parseStartupThemeSnapshot(JSON.stringify({ version: 1, theme: "dark", canvas: "#16171a", wallpaper: 'url("https://example.com/remote.jpg")' }))?.wallpaper).toBe("none");
  });

  it("persists only safe visual data and applies it synchronously", () => {
    storeStartupThemeSnapshot(true, {
      "--color-canvas": "#16171a",
      "--wallpaper-image": 'url("/wallpapers/quiet-aurora.webp")',
      "--color-text": "sensitive-value-that-is-not-persisted",
    });
    const raw = localStorage.getItem(STARTUP_SNAPSHOT_KEY);
    expect(raw).not.toContain("sensitive-value");
    const snapshot = readStartupThemeSnapshot();
    expect(snapshot).not.toBeNull();
    applyStartupThemeSnapshot(document.documentElement, snapshot!);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--startup-canvas")).toBe("#16171a");
    expect(document.documentElement.style.getPropertyValue("--startup-wallpaper")).toContain("quiet-aurora.webp");
  });

  it("falls back safely when storage is denied", () => {
    const denied = { getItem: () => { throw new Error("denied"); } };
    expect(readStartupThemeSnapshot(denied)).toBeNull();
    expect(() => storeStartupThemeSnapshot(false, {}, { setItem: () => { throw new Error("denied"); } })).not.toThrow();
  });

  it("extracts local, blob and encoded CSS image URLs", () => {
    expect(extractCssImageUrl('url("/wallpapers/dusk.webp")')).toBe("/wallpapers/dusk.webp");
    expect(extractCssImageUrl("url(blob:wallpaper)")).toBe("blob:wallpaper");
    expect(extractCssImageUrl("none")).toBeNull();
  });

  it("loads critical dark paint and bootstrap logic before React", () => {
    const html = readFileSync(resolve("entrypoints/newtab/index.html"), "utf8");
    const css = readFileSync(resolve("entrypoints/newtab/bootstrap.css"), "utf8");
    expect(html).toContain('<meta name="color-scheme" content="dark" />');
    expect(html.indexOf("bootstrap.css")).toBeLessThan(html.indexOf("<body>"));
    expect(html.indexOf("bootstrap.ts")).toBeLessThan(html.indexOf("main.tsx"));
    expect(css).toContain("--startup-canvas: #111318");
    expect(css).toContain("#root");
    expect(css).toContain("visibility: hidden");
    expect(css).toContain('html[data-asterfold-ready="true"] #root');
    expect(css).toContain("asterfold-board-in");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
