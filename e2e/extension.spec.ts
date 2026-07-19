import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const screenshotPath = resolve("artifacts/screenshots");
const knownBrowserPaths = [
  process.env.ASTERFOLD_CHROMIUM_PATH,
  "/tmp/asterfold-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((value): value is string => Boolean(value));

function browserPath(): string {
  const found = knownBrowserPaths.find(existsSync);
  if (!found) throw new Error("Chromium is missing. Run `npx playwright install chromium` or set ASTERFOLD_CHROMIUM_PATH.");
  return found;
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent("serviceworker", { timeout: 15_000 });
}

async function finishOnboarding(page: Page): Promise<void> {
  const start = page.getByRole("button", { name: "Start with Inbox" });
  if (await start.isVisible()) await start.click();
}

test.describe.serial("Asterfold MV3 release", () => {
  let context: BrowserContext;
  let worker: Worker;
  let extensionId: string;
  const runtimeErrors: string[] = [];

  test.beforeAll(async () => {
    expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
    mkdirSync(screenshotPath, { recursive: true });
    const home = join(tmpdir(), "asterfold-playwright-home");
    mkdirSync(join(home, ".cache", "fontconfig"), { recursive: true });
    mkdirSync(join(home, ".config"), { recursive: true });
    const shim = process.env.ASTERFOLD_SOCKET_SHIM;
    context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-e2e-${Date.now()}`), {
      executablePath: browserPath(),
      channel: "chromium",
      headless: true,
      env: {
        ...process.env,
        ...(shim ? { LD_PRELOAD: shim } : {}),
        HOME: home,
        XDG_CACHE_HOME: join(home, ".cache"),
        XDG_CONFIG_HOME: join(home, ".config"),
      },
      args: [
        "--no-sandbox",
        "--disable-crash-reporter",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    worker = await extensionWorker(context);
    extensionId = new URL(worker.url()).hostname;
    context.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("loads the unpacked MV3 service worker with least privilege", async () => {
    const probe = await worker.evaluate(async () => ({
      manifest: chrome.runtime.getManifest(),
      commands: await chrome.commands.getAll(),
    }));
    expect(probe.manifest.manifest_version).toBe(3);
    expect(probe.manifest.chrome_url_overrides?.newtab).toBe("newtab.html");
    expect(probe.manifest.action?.default_popup).toBe("popup.html");
    expect(probe.manifest.permissions).toEqual(expect.arrayContaining(["activeTab", "alarms", "contextMenus", "favicon", "storage"]));
    expect(probe.manifest.permissions).not.toEqual(expect.arrayContaining(["tabs", "history", "scripting", "webRequest"]));
    expect(probe.manifest.host_permissions ?? []).toEqual([]);
    expect(probe.commands.find((command) => command.name === "quick-save")?.shortcut).toBeTruthy();
  });

  test("persists CRUD, drag-and-drop, search, privacy, theme, and Trash", async () => {
    const page = await context.newPage();
    page.on("pageerror", (error) => runtimeErrors.push(`newtab: ${error.message}`));
    await page.addInitScript(() => {
      const samples: number[] = [];
      (globalThis as typeof globalThis & { __asterfoldLongTasks: number[] }).__asterfoldLongTasks = samples;
      if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        new PerformanceObserver((list) => samples.push(...list.getEntries().map((entry) => entry.duration))).observe({ type: "longtask", buffered: true });
      }
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page.getByRole("heading", { name: "Workspace", level: 1 })).toBeVisible();
    const coldInteractive = await page.evaluate(() => performance.getEntriesByName("asterfold-interactive")[0]?.startTime ?? performance.now());
    console.info(`PERF newtab_interactive_ms=${coldInteractive.toFixed(2)}`);
    await finishOnboarding(page);

    await page.getByLabel("Add", { exact: true }).click();
    await page.locator(".add-menu .menu__popover").getByRole("button", { name: "Add Page", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Research");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: "Research", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Create your first board" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Reading");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Reading", { exact: true })).toBeVisible();

    await page.getByRole("main").getByRole("button", { name: "Add bookmark", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Playwright docs");
    await dialog.getByLabel("URL").fill("https://playwright.dev/docs/chrome-extensions");
    await dialog.getByLabel("Description").fill("Extension testing reference");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("main").getByText("Playwright docs", { exact: true })).toBeVisible();
    const localSave = await page.evaluate(() => performance.getEntriesByName("asterfold-local-save").at(-1)?.duration ?? Number.NaN);
    console.info(`PERF local_save_feedback_ms=${localSave.toFixed(2)}`);
    expect(localSave).toBeLessThan(100);

    await page.getByRole("main").getByRole("button", { name: "Add board", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Later");
    await dialog.getByRole("button", { name: "Create" }).click();
    const dragHandle = page.getByLabel("Move Playwright docs");
    const targetBoard = page.locator(".board").filter({ hasText: "Later" });
    const sourceBox = await dragHandle.boundingBox();
    const targetBox = await targetBoard.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + 20, sourceBox!.y + 20, { steps: 5 });
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(targetBoard.getByText("Playwright docs", { exact: true })).toBeVisible();

    const warmSamples: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Research", level: 1 })).toBeVisible();
      warmSamples.push(await page.evaluate(() => performance.getEntriesByName("asterfold-interactive")[0]?.startTime ?? performance.now()));
    }
    const warmMedian = [...warmSamples].sort((a, b) => a - b)[Math.floor(warmSamples.length / 2)]!;
    console.info(`PERF newtab_warm_samples_ms=${warmSamples.map((value) => value.toFixed(2)).join(",")} median=${warmMedian.toFixed(2)}`);
    expect(warmMedian).toBeLessThan(300);
    await expect(targetBoard.getByText("Playwright docs", { exact: true })).toBeVisible();
    await page.keyboard.press("Control+K");
    dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/Search title/u).fill("playwrite");
    await expect(dialog.getByRole("listbox").getByRole("option")).toContainText("Playwright docs");
    await page.keyboard.press("Escape");

    await page.getByLabel("Turn Privacy Mode on").click();
    await expect(page.getByText("Privacy on", { exact: true })).toBeVisible();
    await page.getByText("Search protected", { exact: true }).click();
    await expect(page.getByRole("dialog").getByPlaceholder(/Search title/u)).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Turn off" }).click();

    await page.getByLabel("Settings").click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Appearance" }).click();
    const themePresets = [
      ["Frost Light", "frost-light"],
      ["Graphite Dark", "graphite-dark"],
      ["Midnight", "midnight"],
      ["Aurora", "aurora"],
      ["Warm Paper", "warm-paper"],
      ["High Contrast", "high-contrast"],
    ] as const;
    for (const [name, id] of themePresets) {
      await dialog.getByRole("button", { name, exact: true }).click();
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe(id);
      await dialog.getByRole("button", { name: "Close" }).click();
      while (await page.locator('.toast [aria-label="Dismiss"]').count()) await page.locator('.toast [aria-label="Dismiss"]').first().click();
      await page.screenshot({ path: join(screenshotPath, `theme-${id}.png`), fullPage: true });
      await page.getByLabel("Settings").click();
      dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Appearance" }).click();
    }
    await dialog.getByRole("button", { name: /Graphite Dark/u }).click();
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("graphite-dark");
    await dialog.getByRole("button", { name: "Import & Export" }).click();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /JSON backup/u }).click();
    const backupDownload = await downloadPromise;
    expect(backupDownload.suggestedFilename()).toMatch(/^asterfold-backup-\d{4}-\d{2}-\d{2}\.json$/u);
    const backupPath = await backupDownload.path();
    expect(backupPath).not.toBeNull();
    await dialog.locator('input[type="file"][accept*="text/html"]').setInputFiles({
      name: "asterfold-roundtrip.json",
      mimeType: "application/json",
      buffer: readFileSync(backupPath!),
    });
    await expect(dialog.getByRole("heading", { name: /Backup preview/u })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await dialog.getByRole("button", { name: "Close" }).click();
    expect(await page.locator(".board__title").first().evaluate((element) => getComputedStyle(element).color)).toBe("rgb(242, 244, 247)");

    await page.getByLabel("Actions for Playwright docs").click();
    await page.getByRole("button", { name: "Move to Trash" }).click();
    await expect(page.getByText("Playwright docs", { exact: true })).toHaveCount(0);
    await page.getByLabel("Trash").click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Playwright docs", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Restore" }).click();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(targetBoard.getByText("Playwright docs", { exact: true })).toBeVisible();

    const quickSave = await page.evaluate(async () => new Promise<{ ok: boolean; message?: string }>((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "INSTANT_SAVE",
        url: "https://example.com/background-capture",
        title: "Background capture",
        faviconUrl: null,
      }, (response: { ok: boolean; message?: string } | undefined) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (response) resolve(response);
        else reject(new Error("Quick Save returned no response"));
      });
    }));
    expect(quickSave.ok).toBe(true);
    await page.keyboard.press("Control+K");
    dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/Search title/u).fill("Background capture");
    await expect(dialog.getByRole("listbox").getByRole("option")).toContainText("Background capture");
    await page.keyboard.press("Escape");

    const mirror = await context.newPage();
    mirror.on("pageerror", (error) => runtimeErrors.push(`mirror: ${error.message}`));
    await mirror.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(mirror.getByRole("heading", { name: "Research", level: 1 })).toBeVisible();
    await mirror.getByLabel("Add", { exact: true }).click();
    await mirror.locator(".add-menu .menu__popover").getByRole("button", { name: "Add Page", exact: true }).click();
    const mirrorDialog = mirror.getByRole("dialog");
    await mirrorDialog.getByLabel("Name").fill("Live tab");
    await mirrorDialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: "Live tab", level: 1 })).toBeVisible();
    await mirror.close();

    while (await page.locator('.toast [aria-label="Dismiss"]').count()) await page.locator('.toast [aria-label="Dismiss"]').first().click();
    const longestTask = await page.evaluate(() => Math.max(0, ...(globalThis as typeof globalThis & { __asterfoldLongTasks: number[] }).__asterfoldLongTasks));
    console.info(`PERF longest_browser_task_ms=${longestTask.toFixed(2)}`);
    expect(longestTask).toBeLessThan(200);
    await page.screenshot({ path: join(screenshotPath, "newtab-graphite.png"), fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ path: join(screenshotPath, "newtab-graphite-1920.png"), fullPage: true });
    await page.setViewportSize({ width: 760, height: 900 });
    await page.screenshot({ path: join(screenshotPath, "newtab-graphite-narrow.png"), fullPage: true });
    await page.close();
  });

  test("renders the real popup against shared extension storage", async () => {
    const popup = await context.newPage();
    popup.on("pageerror", (error) => runtimeErrors.push(`popup: ${error.message}`));
    await popup.setViewportSize({ width: 420, height: 760 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole("heading", { name: "Quick Save" })).toBeVisible();
    const popupInteractive = await popup.evaluate(() => performance.getEntriesByName("asterfold-popup-interactive")[0]?.startTime ?? performance.now());
    console.info(`PERF popup_interactive_ms=${popupInteractive.toFixed(2)}`);
    expect(await popup.getByLabel("Page").locator("option").allTextContents()).toEqual(["Workspace", "Research", "Live tab"]);
    await expect(popup.getByLabel("Board")).toContainText("Inbox");
    await popup.screenshot({ path: join(screenshotPath, "popup.png"), fullPage: true });
    await popup.close();
    expect(runtimeErrors).toEqual([]);
  });
});
