import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Worker } from "@playwright/test";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const knownBrowserPaths = [
  process.env.ASTERFOLD_CHROMIUM_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((value): value is string => Boolean(value));

interface StartupSample {
  time: number;
  ready: boolean;
  htmlBackground: string;
  bodyBackground: string;
  rootOpacity: number | null;
  rootVisibility: string | null;
  loadingVisible: boolean;
  boardAnimation: string | null;
}

function browserPath(): string {
  const found = knownBrowserPaths.find(existsSync);
  if (!found) throw new Error("Chromium is missing. Set ASTERFOLD_CHROMIUM_PATH.");
  return found;
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers().find((candidate) => candidate.url().startsWith("chrome-extension://"))
    ?? context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().startsWith("chrome-extension://"), timeout: 15_000 });
}

function luminance(color: string): number | null {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3) return null;
  const [red, green, blue] = values;
  if (red === undefined || green === undefined || blue === undefined) return null;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

async function useDarkWallpaper(pageUrl: string, context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await page.goto(pageUrl);
  await expect(page.locator("html")).toHaveAttribute("data-asterfold-ready", "true");
  await page.evaluate(async () => {
    const request = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    });
    const transaction = database.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");
    const settings = await new Promise<Record<string, unknown> & { theme: Record<string, unknown> }>((resolvePromise, reject) => {
      const get = store.get("app");
      get.onsuccess = () => resolvePromise(get.result as Record<string, unknown> & { theme: Record<string, unknown> });
      get.onerror = () => reject(get.error ?? new Error("Unable to read settings"));
    });
    store.put({
      ...settings,
      onboardingComplete: true,
      theme: {
        ...settings.theme,
        mode: "dark",
        motion: true,
        backgroundMode: "wallpaper",
        wallpaperId: "builtin-dusk",
      },
      updatedAt: new Date().toISOString(),
    });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write settings"));
    });
    database.close();
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-asterfold-ready", "true");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("asterfold:startup-theme:v1"))).toContain("dusk.webp");
  await page.close();
}

test("new tab keeps a stable first paint and reveals the workspace once", async () => {
  expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-startup-${Date.now()}`), {
    executablePath: browserPath(),
    headless: true,
    reducedMotion: "no-preference",
    args: ["--no-sandbox", "--disable-crash-reporter", "--disable-features=DisableLoadExtensionCommandLineSwitch", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).hostname;
    const pageUrl = `chrome-extension://${extensionId}/newtab.html`;
    await useDarkWallpaper(pageUrl, context);

    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      const samples: StartupSample[] = [];
      Object.defineProperty(window, "__asterfoldStartupSamples", { configurable: true, value: samples });
      const start = performance.now();
      const sample = (): void => {
        const root = document.getElementById("root");
        const rootStyle = root ? getComputedStyle(root) : null;
        const board = document.querySelector<HTMLElement>(".board");
        const loading = document.querySelector<HTMLElement>(".app-loading");
        samples.push({
          time: performance.now() - start,
          ready: document.documentElement.dataset.asterfoldReady === "true",
          htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
          bodyBackground: document.body ? getComputedStyle(document.body).backgroundColor : "",
          rootOpacity: rootStyle ? Number(rootStyle.opacity) : null,
          rootVisibility: rootStyle?.visibility ?? null,
          loadingVisible: Boolean(loading && rootStyle?.visibility !== "hidden" && Number(rootStyle?.opacity ?? 0) > 0.01),
          boardAnimation: board ? getComputedStyle(board).animationName : null,
        });
        if (performance.now() - start < 1_500) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await page.goto(pageUrl);
    await expect(page.locator("html")).toHaveAttribute("data-asterfold-ready", "true");
    await expect(page.locator(".board").first()).toBeVisible();
    await page.waitForTimeout(1_000);

    const samples = await page.evaluate(() => (window as typeof window & { __asterfoldStartupSamples: StartupSample[] }).__asterfoldStartupSamples);
    expect(samples.length).toBeGreaterThan(10);
    const beforeReady = samples.filter((sample) => !sample.ready && sample.rootOpacity !== null);
    expect(beforeReady.length).toBeGreaterThan(0);
    expect(beforeReady.every((sample) => sample.rootOpacity !== null && sample.rootOpacity <= 0.01 && sample.rootVisibility === "hidden")).toBe(true);
    expect(samples.some((sample) => sample.loadingVisible)).toBe(false);

    const luminances = samples.flatMap((sample) => [luminance(sample.htmlBackground), luminance(sample.bodyBackground)]).filter((value): value is number => value !== null);
    expect(Math.max(...luminances)).toBeLessThan(246);

    const visibleOpacities = samples.map((sample) => sample.rootOpacity).filter((value): value is number => value !== null && value > 0.01);
    expect(visibleOpacities.at(-1)).toBeGreaterThanOrEqual(0.99);
    for (let index = 1; index < visibleOpacities.length; index += 1) {
      const previous = visibleOpacities[index - 1];
      const current = visibleOpacities[index];
      if (previous === undefined || current === undefined) throw new Error("Opacity sample sequence is incomplete");
      expect(current + 0.08).toBeGreaterThanOrEqual(previous);
    }
    expect(samples.some((sample) => sample.boardAnimation === "asterfold-board-in")).toBe(true);
    await expect(page.locator("html")).not.toHaveAttribute("data-asterfold-entering", "true");
  } finally {
    await context.close();
  }
});
