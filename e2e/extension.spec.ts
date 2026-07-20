import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const screenshotPath = resolve("docs/images");
const captureScreenshots = process.env.ASTERFOLD_CAPTURE_SCREENSHOTS === "1";
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
  const found = knownBrowserPaths.find(existsSync);
  if (!found) throw new Error("Chromium is missing. Set ASTERFOLD_CHROMIUM_PATH.");
  return found;
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers().find((candidate) => candidate.url().startsWith("chrome-extension://"));
  return existing ?? context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().startsWith("chrome-extension://"), timeout: 15_000 });
}

async function openLauncher(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Открыть меню Asterfold" }).click();
}

async function seedScaleFixture(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const request = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    });
    const transaction = database.transaction(["pages", "boards", "bookmarks", "settings"], "readwrite");
    const get = <T,>(store: string, key: IDBValidKey): Promise<T> => new Promise((resolvePromise, reject) => {
      const query = transaction.objectStore(store).get(key);
      query.onsuccess = () => resolvePromise(query.result as T);
      query.onerror = () => reject(query.error ?? new Error(`Unable to read ${store}`));
    });
    const settings = await get<{ activePageId: string; workspaceRows: 1 | 2; workspaceLayoutMode: "auto" | "free"; workspaceAlignment: "left" | "center" | "right" }>("settings", "app");
    const timestamp = new Date().toISOString();
    transaction.objectStore("boards").clear();
    transaction.objectStore("bookmarks").clear();
    for (let boardIndex = 0; boardIndex < 4; boardIndex += 1) {
      const boardId = `scale-board-${boardIndex}`;
      transaction.objectStore("boards").put({ id: boardId, userId: null, pageId: settings.activePageId, title: ["Product", "Design", "Research", "Operations"][boardIndex], icon: null, accent: null, position: `a${boardIndex}`, collapsed: false, layout: "grid", bookmarkColumns: 2, gridColumn: boardIndex % 2 === 0 ? 1 : 7, gridRow: boardIndex < 2 ? 0 : 1, gridSpan: 6, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
      for (let index = 0; index < 25; index += 1) {
        const url = `https://example.com/${boardIndex}/${index}`;
        transaction.objectStore("bookmarks").put({ id: `scale-bookmark-${boardIndex}-${index}`, userId: null, boardId, title: `Bookmark ${boardIndex + 1}.${index + 1}`, url, normalizedUrl: url, hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: `a${String(index).padStart(2, "0")}`, openMode: "new-tab", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
      }
    }
    transaction.objectStore("settings").put({ ...settings, workspaceRows: 2, workspaceLayoutMode: "auto", workspaceAlignment: "center" });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write scale fixture"));
    });
    database.close();
  });
}

test.describe.serial("Asterfold MV3 release", () => {
  let context: BrowserContext;
  let worker: Worker;
  let extensionId: string;
  const runtimeErrors: string[] = [];

  test.beforeAll(async () => {
    expect(existsSync(join(extensionPath, "manifest.json"))).toBe(true);
    if (captureScreenshots) mkdirSync(screenshotPath, { recursive: true });
    context = await chromium.launchPersistentContext(join(tmpdir(), `asterfold-e2e-${Date.now()}`), {
      executablePath: browserPath(),
      headless: true,
      args: ["--no-sandbox", "--disable-crash-reporter", "--disable-features=DisableLoadExtensionCommandLineSwitch", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 2 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 2 });
    });
    worker = await extensionWorker(context);
    extensionId = new URL(worker.url()).hostname;
    await expect.poll(() => worker.evaluate(() => Boolean(globalThis.chrome?.runtime?.id)), { timeout: 15_000 }).toBe(true);
    context.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`); });
  });

  test.afterAll(async () => { await context.close(); });

  test("loads the unpacked MV3 worker with least privilege", async () => {
    const probe = await worker.evaluate(async () => ({ manifest: chrome.runtime.getManifest(), commands: await chrome.commands.getAll() }));
    expect(probe.manifest.manifest_version).toBe(3);
    expect(probe.manifest.chrome_url_overrides?.newtab).toBe("newtab.html");
    expect(probe.manifest.action?.default_popup).toBe("popup.html");
    expect(probe.manifest.permissions).toEqual(expect.arrayContaining(["activeTab", "alarms", "contextMenus", "favicon", "storage"]));
    expect(probe.manifest.permissions).not.toEqual(expect.arrayContaining(["tabs", "history", "scripting", "webRequest"]));
    expect(probe.manifest.host_permissions ?? []).toEqual([]);
  });

  test("persists core flows and fits 100 bookmarks without desktop scroll", async () => {
    const page = await context.newPage();
    page.on("pageerror", (error) => runtimeErrors.push(`newtab: ${error.message}`));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page).toHaveTitle("Новая вкладка");
    await expect(page.locator(".app-shell")).toHaveClass(/performance-reduced/u);
    await expect(page.locator(".wallpaper")).toHaveCSS("filter", "none");
    await expect(page.getByRole("button", { name: "Открыть меню Asterfold" })).toBeVisible();

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Страницы" }).click();
    await page.getByRole("button", { name: "Создать страницу" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название").fill("Research");
    await dialog.getByRole("button", { name: "Создать" }).click();
    await page.getByRole("button", { name: "Создать" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название").fill("Reading");
    await dialog.getByRole("button", { name: "Создать" }).click();

    await page.getByRole("button", { name: "Добавить закладку в Reading" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название").fill("Playwright docs");
    await dialog.getByLabel("URL").fill("https://playwright.dev/docs/chrome-extensions");
    await dialog.getByLabel("Описание").fill("Extension testing reference");
    await dialog.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Playwright docs", { exact: true })).toBeVisible();

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Новый блок" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название").fill("Later");
    await dialog.getByRole("button", { name: "Создать" }).click();
    const source = page.getByRole("button", { name: "Playwright docs" });
    const target = page.locator(".board").filter({ hasText: "Later" });
    const boardOrderBefore = await page.locator(".board__title").allTextContents();
    await page.getByRole("button", { name: "Действия блока Reading" }).focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect.poll(async () => page.locator(".board__title").allTextContents()).not.toEqual(boardOrderBefore);
    await expect(page.locator(".drag-overlay")).toHaveCount(0);
    await source.click({ button: "right" });
    await page.getByRole("button", { name: "Переместить", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Назначение").selectOption({ label: "Later" });
    await dialog.getByRole("button", { name: "Переместить", exact: true }).click();
    await expect(target.getByText("Playwright docs", { exact: true })).toBeVisible();
    await page.reload();
    await expect(target.getByText("Playwright docs", { exact: true })).toBeVisible();

    await page.keyboard.press("Control+K");
    dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/Название, URL/u).fill("playwrite");
    await expect(dialog.getByRole("option", { name: /Playwright docs/u })).toBeVisible();
    await page.keyboard.press("Escape");

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Включить приватность" }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/privacy-mode/u);
    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Выключить приватность" }).click();

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Настройки" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Язык" }).click();
    await dialog.getByRole("button", { name: "Қазақша" }).click();
    await expect(page).toHaveTitle("Жаңа қойынды");
    await dialog.getByRole("button", { name: "Тіл", exact: true }).click();
    await dialog.getByRole("button", { name: "Русский" }).click();
    await dialog.getByRole("button", { name: "Данные и приватность" }).click();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Резервная копия JSON/u }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/^asterfold-backup-v2-\d{4}-\d{2}-\d{2}\.json$/u);
    await dialog.getByRole("button", { name: "Закрыть" }).click();

    await page.getByRole("button", { name: "Playwright docs" }).click({ button: "right" });
    await page.getByRole("button", { name: "В корзину" }).click();
    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Корзина" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Восстановить" }).click();
    await dialog.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByText("Playwright docs", { exact: true })).toBeVisible();

    await seedScaleFixture(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await expect(page.locator(".bookmark-card")).toHaveCount(100);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    if (captureScreenshots) await page.screenshot({ path: join(screenshotPath, "scale-1280x720.png") });
    await page.setViewportSize({ width: 1672, height: 941 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    if (captureScreenshots) await page.screenshot({ path: join(screenshotPath, "scale-1920x1080.png") });
    expect(runtimeErrors).toEqual([]);
    await page.close();
  });
});
