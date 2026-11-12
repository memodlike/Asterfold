import { existsSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Worker } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const knownBrowserPaths = [
  process.env.ASTERFOLD_CHROMIUM_PATH,
  "/tmp/asterfold-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  "/tmp/asterfold-playwright/chromium-1194/chrome-linux/chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
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

test("fresh profile completes accessible guided setup and never reopens it", async () => {
  expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-onboarding-${Date.now()}`), {
    executablePath: browserPath(),
    headless: false,
    reducedMotion: "reduce",
    args: [
      "--headless=new",
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
    await expect(page.locator(".onboarding-tile")).toHaveCount(3);
    await expect(dialog.getByRole("button", { name: "Continue" })).toHaveCount(0);

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
    // The language picker keeps initial focus; the modal must not move it to the first header button.
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Interface language");

    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.querySelector("[role='dialog']")?.contains(document.activeElement))).toBe(true);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);

    const transitionDurations = await dialog.evaluate((element) => [...element.querySelectorAll<HTMLElement>("*")]
      .map((node) => getComputedStyle(node).transitionDuration)
      .filter(Boolean));
    expect(transitionDurations.every((duration) => Number.parseFloat(duration) <= 0.001)).toBe(true);

    // The skip link stays inside the viewport and inside the dialog header.
    const skip = dialog.locator(".onboarding-skip");
    const skipBounds = await skip.boundingBox();
    expect(skipBounds!.x + skipBounds!.width).toBeLessThanOrEqual(1280);

    await skip.click();
    const confirmation = page.locator(".onboarding-confirm-modal");
    await expect(confirmation).toBeVisible();
    await confirmation.locator(".modal__footer button").first().click();
    await expect(page.locator(".onboarding-modal")).toBeVisible();

    await dialog.locator(".onboarding-skip").click();
    await confirmation.locator(".modal__footer button").last().click();
    await expect(page.locator(".onboarding-modal")).toHaveCount(0);
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
    // Skipping setup also skips the tips.
    await expect(page.getByTestId("guide-tour")).toHaveCount(0);
    await page.close();
  } finally {
    await context.close();
  }
});


test("a Chrome export moves in with its icons, tips appear once and site icons come only from bookmarked sites", async () => {
  const context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-import-guide-${Date.now()}`), {
    executablePath: browserPath(),
    headless: false,
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-crash-reporter",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const webRequests: string[] = [];
  const served = new Map<string, Buffer>();
  const server = createServer((request, response) => {
    const host = (request.headers.host ?? "").split(":")[0] ?? "";
    webRequests.push(`${host}${request.url ?? ""}`);
    const icon = request.url === "/favicon.ico" ? served.get(host) : undefined;
    if (icon) response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }).end(icon);
    else response.writeHead(404).end();
  });
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const port = (server.address() as AddressInfo).port;

  try {
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Two local "sites": one serves a favicon, one has none. Every request they receive is recorded.
    const siteIcon = await page.screenshot({ clip: { x: 0, y: 0, width: 16, height: 16 } });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page.locator(".onboarding-tile")).toHaveCount(3);
    const withIcon = `http://with-site-icon.localhost:${String(port)}`;
    const withoutIcon = `http://no-icon.localhost:${String(port)}`;
    served.set("with-site-icon.localhost", siteIcon);

    // Choosing a browser import shows the three export steps; no permission prompt, no picker yet.
    await page.getByRole("radio").nth(1).click();
    const guide = page.locator(".import-guide");
    await expect(guide).toBeVisible();
    await expect(guide.locator("ol > li")).toHaveCount(3);

    const storedIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7S8AAAAASUVORK5CYII=";
    const exported = [
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
      "<DL><p>",
      "  <DT><H3>Bookmarks bar</H3>",
      "  <DL><p>",
      `    <DT><A HREF="https://stored-icon.example/" ICON="${storedIcon}">Stored icon</A>`,
      `    <DT><A HREF="${withIcon}/docs">Site icon</A>`,
      `    <DT><A HREF="${withoutIcon}/">No icon</A>`,
      "  </DL><p>",
      "</DL><p>",
    ].join("\n");
    await page.getByTestId("import-guide-file").setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(exported, "utf8") });
    await expect(page.locator(".onboarding-status.is-ready")).toBeVisible();
    await page.locator(".onboarding-open").click();
    await expect(page.locator(".onboarding-modal")).toHaveCount(0);

    // Tips appear once, are a labelled dialog, and Escape ends them for good.
    const tour = page.getByTestId("guide-tour");
    await expect(tour).toBeVisible();
    await expect(tour.getByRole("dialog")).toHaveAccessibleName(/\S/u);
    const accessibility = await new AxeBuilder({ page }).include(".tour").analyze();
    expect(accessibility.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);

    // The icon from the file is shown from local data; the others ask only their own site.
    const cards = page.locator(".bookmark-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator("img")).toHaveAttribute("src", storedIcon);
    await expect(cards.nth(1).locator("img.is-loaded")).toHaveAttribute("src", `${withIcon}/favicon.ico`);
    await expect(cards.nth(1).locator(".favicon__monogram")).toHaveCount(0);
    await expect(cards.nth(2).locator(".favicon__monogram")).toBeVisible();
    await expect(cards.nth(2).locator("img")).toHaveCount(0);
    expect([...new Set(webRequests)].sort()).toEqual(["no-icon.localhost/favicon.ico", "with-site-icon.localhost/favicon.ico"]);

    // A site without an icon is remembered; switching site icons off stops every request.
    webRequests.length = 0;
    await page.waitForTimeout(800);
    await page.reload();
    await expect(cards).toHaveCount(3);
    await expect(tour).toHaveCount(0);
    await expect(cards.nth(1).locator("img.is-loaded")).toBeVisible();
    expect(webRequests.filter((url) => url.startsWith("no-icon."))).toEqual([]);
    await page.evaluate(() => localStorage.setItem("asterfold:site-icons:v1", "off"));
    webRequests.length = 0;
    await page.reload();
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(1).locator(".favicon__monogram")).toBeVisible();
    await expect(cards.nth(0).locator("img")).toHaveAttribute("src", storedIcon);
    expect(webRequests).toEqual([]);
    await page.close();
  } finally {
    await context.close();
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
});
