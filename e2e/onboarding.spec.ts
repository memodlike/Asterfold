import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Worker } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const knownBrowserPaths = [
  process.env.ASTERFOLD_CHROMIUM_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((value): value is string => Boolean(value));

function browserPath(): string {
  const found = knownBrowserPaths.find(existsSync);
  if (!found) throw new Error("Chromium is missing. Set ASTERFOLD_CHROMIUM_PATH.");
  return found;
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers().find((candidate) => candidate.url().startsWith("chrome-extension://"))
    ?? context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().startsWith("chrome-extension://"), timeout: 15_000 });
}

test("fresh profile completes accessible guided setup and never reopens it", async () => {
  expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-onboarding-${Date.now()}`), {
    executablePath: browserPath(),
    headless: true,
    reducedMotion: "reduce",
    args: [
      "--no-sandbox",
      "--disable-crash-reporter",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAccessibleName(/\S/u);
    await expect(page.locator(".onboarding-progress span")).toHaveCount(4);

    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)).toBe(true);

    const activeInside = await page.evaluate(() => {
      const active = document.activeElement;
      const modal = document.querySelector("[role='dialog']");
      return Boolean(active && modal?.contains(active));
    });
    expect(activeInside).toBe(true);

    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.querySelector("[role='dialog']")?.contains(document.activeElement))).toBe(true);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);

    const transitionDurations = await dialog.evaluate((element) => [...element.querySelectorAll<HTMLElement>("*")]
      .map((node) => getComputedStyle(node).transitionDuration)
      .filter(Boolean));
    expect(transitionDurations.every((duration) => Number.parseFloat(duration) <= 0.001)).toBe(true);

    await dialog.locator(".modal__header button").click();
    const confirmation = page.locator(".onboarding-confirm-modal");
    await expect(confirmation).toBeVisible();
    await confirmation.locator(".modal__footer button").first().click();
    await expect(page.locator(".launcher-discovery")).toBeVisible();

    await page.locator(".launcher-discovery__dismiss").click();
    await expect(page.locator(".launcher-discovery")).toHaveCount(0);
    await expect(page.locator(".app-shell")).toBeVisible();

    const lifecycle = await page.evaluate(async () => {
      const request = indexedDB.open("asterfold");
      const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
      });
      const transaction = database.transaction("settings", "readonly");
      const settings = await new Promise<{ onboardingVersion: number; onboardingComplete: boolean }>((resolvePromise, reject) => {
        const get = transaction.objectStore("settings").get("app");
        get.onsuccess = () => resolvePromise(get.result as { onboardingVersion: number; onboardingComplete: boolean });
        get.onerror = () => reject(get.error ?? new Error("Unable to read settings"));
      });
      database.close();
      return settings;
    });
    expect(lifecycle).toMatchObject({ onboardingVersion: 1, onboardingComplete: true });

    await page.reload();
    await expect(page.locator(".launcher-discovery")).toHaveCount(0);
    await expect(page.locator(".app-shell")).toBeVisible();
    await page.close();
  } finally {
    await context.close();
  }
});
