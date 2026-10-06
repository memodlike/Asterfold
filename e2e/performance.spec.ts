import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const knownBrowserPaths = [
  process.env.ASTERFOLD_CHROMIUM_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((value): value is string => Boolean(value));

function browserPath(): string {
  if (process.env.ASTERFOLD_CHROMIUM_PATH && existsSync(process.env.ASTERFOLD_CHROMIUM_PATH)) {
    return process.env.ASTERFOLD_CHROMIUM_PATH;
  }
  try {
    const pwPath = chromium.executablePath();
    if (pwPath && existsSync(pwPath)) return pwPath;
  } catch {
    // fallback
  }
  const found = knownBrowserPaths.find(existsSync);
  if (!found) throw new Error("Chromium is missing. Set ASTERFOLD_CHROMIUM_PATH.");
  return found;
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers().find((candidate) => candidate.url().startsWith("chrome-extension://"))
    ?? context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().startsWith("chrome-extension://"), timeout: 15_000 });
}

async function seedStressFixture(page: Page, performanceMode: "quality" | "compatibility" = "compatibility"): Promise<void> {
  await page.evaluate(async (performanceMode) => {
    const request = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    });
    const transaction = database.transaction(["boards", "bookmarks", "settings"], "readwrite");
    const settingsStore = transaction.objectStore("settings");
    const settings = await new Promise<Record<string, unknown> & { activePageId: string; theme: Record<string, unknown> }>((resolvePromise, reject) => {
      const get = settingsStore.get("app");
      get.onsuccess = () => resolvePromise(get.result as Record<string, unknown> & { activePageId: string; theme: Record<string, unknown> });
      get.onerror = () => reject(get.error ?? new Error("Unable to read settings"));
    });
    const timestamp = new Date().toISOString();
    transaction.objectStore("boards").clear();
    transaction.objectStore("bookmarks").clear();
    for (let boardIndex = 0; boardIndex < 12; boardIndex += 1) {
      const boardId = `stress-board-${boardIndex}`;
      transaction.objectStore("boards").put({ id: boardId, userId: null, pageId: settings.activePageId, title: `Stress ${boardIndex + 1}`, icon: null, accent: null, position: `b${String(boardIndex).padStart(3, "0")}`, collapsed: false, layout: "grid", bookmarkColumns: 2, gridColumn: boardIndex % 4 * 3 + 1, gridRow: (boardIndex % 2) as 0 | 1, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
      for (let index = 0; index < 50; index += 1) {
        const url = `https://example.com/${boardIndex}/${index}`;
        transaction.objectStore("bookmarks").put({ id: `stress-${boardIndex}-${index}`, userId: null, boardId, title: `Bookmark ${boardIndex + 1}.${index + 1}`, url, normalizedUrl: url, hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: `m${String(index).padStart(3, "0")}`, openMode: "new-tab", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
      }
    }
    settingsStore.put({ ...settings, onboardingComplete: true, workspaceRows: 2, workspaceLayoutMode: "auto", workspaceAlignment: "center", theme: { ...settings.theme, mode: "dark", performanceMode, lowPowerMode: performanceMode === "compatibility", backgroundMode: "wallpaper", wallpaperId: "builtin-aurora", surfaceOpacity: 0.62, wallpaperBlur: 18, wallpaperSaturation: 1.15 }, updatedAt: timestamp });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to seed stress fixture"));
    });
    database.close();
  }, performanceMode);
}

async function frameSample(page: Page): Promise<number[]> {
  return page.evaluate(() => new Promise<number[]>((resolvePromise) => {
    const intervals: number[] = [];
    let previous = performance.now();
    const step = (time: number): void => {
      intervals.push(time - previous);
      previous = time;
      if (intervals.length >= 90) resolvePromise(intervals.slice(1));
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
}

test("compatibility glass survives a 600-bookmark Windows-style stress fixture", async () => {
  expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-stress-${Date.now()}`), {
    executablePath: browserPath(), headless: false,
    args: ["--headless=new", "--no-sandbox", "--disable-crash-reporter", "--disable-features=DisableLoadExtensionCommandLineSwitch", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await seedStressFixture(page);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-performance", "compatibility");
    await expect(page.locator(".bookmark-card")).toHaveCount(600);

    const wallpaper = await page.locator(".wallpaper").evaluate((element) => getComputedStyle(element).filter);
    expect(wallpaper).toBe("none");

    for (let iteration = 0; iteration < 20; iteration += 1) {
      await page.locator(".launcher-trigger").click();
      await expect(page.locator(".launcher-menu")).toBeVisible();
      const backdrop = await page.locator(".launcher-menu").evaluate((element) => getComputedStyle(element).backdropFilter);
      expect(backdrop === "none" || backdrop === "").toBe(true);
      await page.locator(".launcher-trigger").click();
      await expect(page.locator(".launcher-menu")).toHaveCount(0);
    }

    const intervals = await frameSample(page);
    const sorted = [...intervals].sort((left, right) => left - right);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(100);
    expect(Math.max(...intervals)).toBeLessThan(300);
  } finally {
    await context.close();
  }
});

test("quality glass bends only the menu and search rims and releases every filter", async () => {
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-lens-${Date.now()}`), {
    executablePath: browserPath(), headless: false,
    args: ["--headless=new", "--no-sandbox", "--disable-crash-reporter", "--disable-features=DisableLoadExtensionCommandLineSwitch", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = await extensionWorker(context);
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
        failures.push(message.text());
      }
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/newtab.html`);
    await seedStressFixture(page, "quality");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-performance", "quality");
    await expect(page.locator(".bookmark-card")).toHaveCount(600);

    for (let iteration = 0; iteration < 10; iteration += 1) {
      await page.locator(".launcher-trigger").click();
      await expect(page.locator(".launcher-menu")).toHaveAttribute("data-refraction", "on");
      await page.locator(".launcher-trigger").click();
      await expect(page.locator(".launcher-menu")).toHaveCount(0);
    }
    await expect(page.locator(".liquid-glass-defs")).toHaveCount(0);

    await page.locator(".launcher-trigger").click();
    await page.locator(".launcher-menu [role=menuitem][aria-keyshortcuts]").click();
    const field = page.locator(".spotlight__field");
    await expect(field).toHaveAttribute("data-refraction", "on");
    expect(await field.evaluate((element) => getComputedStyle(element).backdropFilter)).toMatch(/url\("#af-lg-\d+"\)/u);
    expect(await page.locator(".board").first().evaluate((element) => element.hasAttribute("data-refraction"))).toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.locator(".liquid-glass-defs")).toHaveCount(0);
    expect(failures).toEqual([]);
  } finally {
    await context.close();
  }
});
