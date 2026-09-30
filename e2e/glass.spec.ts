import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

/*
 * Main-screen glass measured in real pixels of the unpacked MV3 extension.
 * Transmission T = how much of the canvas behind a board reaches the screen, measured by
 * rendering the same board over a solid black and a solid white canvas:
 *   T = (board over white − board over black) / (white − black), 0 = opaque, 1 = clear.
 * The sample is the empty lower part of a board, so text and icons do not take part.
 */

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const knownBrowserPaths = [
  process.env.ASTERFOLD_CHROMIUM_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((value): value is string => Boolean(value));

type Tier = "quality" | "balanced" | "compatibility" | "software";
type Theme = Record<string, unknown>;

function browserPath(): string {
  if (process.env.ASTERFOLD_CHROMIUM_PATH && existsSync(process.env.ASTERFOLD_CHROMIUM_PATH)) return process.env.ASTERFOLD_CHROMIUM_PATH;
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

async function seedTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate(async (patch) => {
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
    for (let index = 0; index < 2; index += 1) {
      const boardId = `glass-board-${String(index)}`;
      transaction.objectStore("boards").put({ id: boardId, userId: null, pageId: settings.activePageId, title: `Glass ${String(index + 1)}`, icon: null, accent: null, position: `b${String(index)}`, collapsed: false, layout: "grid", bookmarkColumns: 1, gridColumn: index * 6 + 1, gridRow: 0, gridSpan: 6, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
      const url = `https://example.com/glass/${String(index)}`;
      transaction.objectStore("bookmarks").put({ id: `glass-bookmark-${String(index)}`, userId: null, boardId, title: "Example", url, normalizedUrl: url, hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: "m0", openMode: "new-tab", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
    }
    settingsStore.put({ ...settings, locale: "en", onboardingComplete: true, workspaceRows: 1, workspaceLayoutMode: "auto", workspaceAlignment: "center", theme: { ...settings.theme, wallpaperDim: 0, wallpaperBlur: 0, wallpaperSaturation: 1, lowPowerMode: false, ...patch }, updatedAt: timestamp });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to seed glass fixture"));
    });
    database.close();
  }, theme);
  await page.reload();
  await expect(page.locator(".board")).toHaveCount(2);
  await page.waitForTimeout(350);
}

/** Mean luminance of the empty lower part of the first board, decoded from a real screenshot. */
async function boardLuminance(page: Page, decoder: Page): Promise<number> {
  const box = await page.locator(".board").first().boundingBox();
  if (!box) throw new Error("Board is not visible");
  const clip = { x: Math.round(box.x + 16), y: Math.round(box.y + box.height * 0.6), width: Math.round(box.width - 32), height: Math.max(8, Math.round(box.height * 0.3)) };
  const png = await page.screenshot({ clip });
  return decoder.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas unavailable");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let total = 0;
    for (let index = 0; index < data.length; index += 4) total += 0.2126 * (data[index] ?? 0) + 0.7152 * (data[index + 1] ?? 0) + 0.0722 * (data[index + 2] ?? 0);
    return total / (data.length / 4);
  }, png.toString("base64"));
}

async function transmission(page: Page, decoder: Page, theme: Theme): Promise<number> {
  await seedTheme(page, { ...theme, backgroundMode: "solid", canvas: "#000000" });
  const overBlack = await boardLuminance(page, decoder);
  await seedTheme(page, { ...theme, backgroundMode: "solid", canvas: "#ffffff" });
  const overWhite = await boardLuminance(page, decoder);
  return (overWhite - overBlack) / 255;
}

test("main-screen boards follow the glass settings in every rendering tier", async () => {
  test.setTimeout(240_000);
  expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-glass-${String(Date.now())}`), {
    executablePath: browserPath(), headless: false,
    args: ["--headless=new", "--no-sandbox", "--disable-crash-reporter", "--disable-features=DisableLoadExtensionCommandLineSwitch", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = await extensionWorker(context);
    const page = await context.newPage();
    const decoder = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/newtab.html`);

    for (const mode of ["light", "dark"] as const) {
      const measure = (performanceMode: Tier, surfaceOpacity: number, glassVariant: "regular" | "clear" = "regular"): Promise<number> =>
        transmission(page, decoder, { mode, performanceMode, surfaceOpacity, glassVariant, blur: 16 });

      // Quality and Balanced: the Glass transparency setting is what reaches the screen.
      const quality = await measure("quality", 0.6);
      expect.soft(quality, `${mode} quality`).toBeGreaterThan(0.34);
      expect.soft(await measure("balanced", 0.6), `${mode} balanced`).toBeGreaterThan(0.34);
      expect.soft(await measure("quality", 0.35), `${mode} quality follows the slider`).toBeGreaterThan(quality + 0.15);
      // Clear is a lighter tint than Regular, not only a different sheen.
      expect.soft(await measure("quality", 0.6, "clear"), `${mode} clear vs regular`).toBeGreaterThan(quality + 0.05);

      // Smooth glass: translucent without live blur, still driven by the setting, and never
      // more transparent than Maximum quality at the same setting.
      const smoothOpaque = await measure("compatibility", 0.8);
      const smoothClear = await measure("compatibility", 0.4);
      expect.soft(smoothOpaque, `${mode} smooth glass stays translucent`).toBeGreaterThan(0.05);
      expect.soft(smoothClear, `${mode} smooth glass follows the slider`).toBeGreaterThan(smoothOpaque + 0.1);
      expect.soft(await measure("compatibility", 0.6), `${mode} smooth glass ≤ quality`).toBeLessThanOrEqual(quality + 0.02);

      // No transparency: fully opaque whatever the setting says.
      expect.soft(await measure("software", 0.4), `${mode} software`).toBeLessThan(0.01);

      // OS-level transparency and contrast requests win over every translucent tier.
      const client = await context.newCDPSession(page);
      for (const feature of [{ name: "prefers-reduced-transparency", value: "reduce" }, { name: "prefers-contrast", value: "more" }]) {
        await client.send("Emulation.setEmulatedMedia", { features: [feature] });
        for (const performanceMode of ["quality", "balanced", "compatibility"] as const) {
          expect.soft(await measure(performanceMode, 0.2), `${mode} ${performanceMode} with ${feature.name}`).toBeLessThan(0.01);
        }
      }
      await client.send("Emulation.setEmulatedMedia", { features: [] });
      await client.detach();
    }

    // Boards frost the wallpaper only through the live-blur tiers.
    for (const [performanceMode, pattern] of [["quality", /blur\(16px\)/u], ["balanced", /blur\(8px\)/u], ["compatibility", /^none$/u], ["software", /^none$/u]] as const) {
      await seedTheme(page, { mode: "light", performanceMode, blur: 16, backgroundMode: "wallpaper", wallpaperId: "builtin-aurora" });
      expect(await page.locator(".board").first().evaluate((element) => getComputedStyle(element).backdropFilter), performanceMode).toMatch(pattern);
    }
    await seedTheme(page, { mode: "light", performanceMode: "quality", blur: 0, backgroundMode: "wallpaper", wallpaperId: "builtin-aurora" });
    expect(await page.locator(".board").first().evaluate((element) => getComputedStyle(element).backdropFilter)).not.toMatch(/blur\([1-9]/u);
    expect(failures).toEqual([]);
  } finally {
    await context.close();
  }
});
