import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const screenshotPath = resolve(process.env.ASTERFOLD_SCREENSHOT_PATH ?? "docs/images");
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

async function captureStoreScreenshot(page: Page, filename: string): Promise<void> {
  if (!captureScreenshots) return;
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(220);
  await page.screenshot({ path: join(screenshotPath, filename) });
  if (previousViewport) await page.setViewportSize(previousViewport);
}

async function dismissToasts(page: Page): Promise<void> {
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 8_000 });
}

async function setWorkspaceLocale(page: Page, locale: string): Promise<void> {
  await page.evaluate(async (nextLocale) => {
    const request = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    });
    const transaction = database.transaction("settings", "readwrite");
    const settingsStore = transaction.objectStore("settings");
    const settings = await new Promise<Record<string, unknown>>((resolvePromise, reject) => {
      const get = settingsStore.get("app");
      get.onsuccess = () => resolvePromise(get.result as Record<string, unknown>);
      get.onerror = () => reject(get.error ?? new Error("Unable to read settings"));
    });
    settingsStore.put({ ...settings, locale: nextLocale, updatedAt: new Date().toISOString() });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write settings"));
    });
    database.close();
  }, locale);
}

async function setWorkspaceThemeMode(page: Page, mode: "light" | "dark"): Promise<void> {
  await page.evaluate(async (nextMode) => {
    const request = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    });
    const transaction = database.transaction("settings", "readwrite");
    const settingsStore = transaction.objectStore("settings");
    const settings = await new Promise<{ theme: Record<string, unknown> }>((resolvePromise, reject) => {
      const get = settingsStore.get("app");
      get.onsuccess = () => resolvePromise(get.result as { theme: Record<string, unknown> });
      get.onerror = () => reject(get.error ?? new Error("Unable to read settings"));
    });
    settingsStore.put({ ...settings, theme: { ...settings.theme, mode: nextMode }, updatedAt: new Date().toISOString() });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write settings"));
    });
    database.close();
  }, mode);
}

async function seedStoreShowcase(page: Page): Promise<void> {
  await page.evaluate(async () => {
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
    const boards = [
      { id: "showcase-work", title: "Work", items: [["GitHub", "https://github.com/"], ["Linear", "https://linear.app/"], ["Notion", "https://www.notion.so/"], ["Google Calendar", "https://calendar.google.com/"]] },
      { id: "showcase-design", title: "Design", items: [["Figma", "https://www.figma.com/"], ["Product references", "https://mobbin.com/"], ["Design system", "https://m3.material.io/"], ["Icons", "https://lucide.dev/"]] },
      { id: "showcase-research", title: "Research", items: [["Reading list", "https://developer.chrome.com/docs/extensions/"], ["Product notes", "https://www.notion.so/"], ["Market research", "https://trends.google.com/"], ["Accessibility", "https://www.w3.org/WAI/"]] },
      { id: "showcase-later", title: "Later", items: [["Playwright docs", "https://playwright.dev/docs/chrome-extensions"], ["Google Docs", "https://docs.google.com/"], ["Meeting notes", "https://www.notion.so/"], ["Roadmap", "https://linear.app/"]] },
    ] as const;
    const timestamp = new Date().toISOString();
    transaction.objectStore("boards").clear();
    transaction.objectStore("bookmarks").clear();
    boards.forEach((board, boardIndex) => {
      transaction.objectStore("boards").put({
        id: board.id,
        userId: null,
        pageId: settings.activePageId,
        title: board.title,
        icon: null,
        accent: null,
        position: String(boardIndex + 1).padStart(12, "0"),
        collapsed: false,
        layout: "list",
        bookmarkColumns: 1,
        gridColumn: boardIndex * 3 + 1,
        gridRow: 0,
        gridSpan: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        deletedBatchId: null,
        version: 1,
      });
      board.items.forEach(([title, url], itemIndex) => {
        transaction.objectStore("bookmarks").put({
          id: `showcase-${boardIndex}-${itemIndex}`,
          userId: null,
          boardId: board.id,
          title,
          url,
          normalizedUrl: url,
          hostname: new URL(url).hostname,
          description: null,
          faviconUrl: null,
          customIcon: null,
          position: String(itemIndex + 1).padStart(12, "0"),
          openMode: "current",
          pinned: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          deletedBatchId: null,
          version: 1,
        });
      });
    });
    settingsStore.put({
      ...settings,
      workspaceRows: 1,
      workspaceLayoutMode: "auto",
      workspaceAlignment: "center",
      theme: {
        ...settings.theme,
        mode: "dark",
        backgroundMode: "wallpaper",
        wallpaperId: "builtin-dusk",
        surfaceOpacity: 0.68,
        blur: 14,
        wallpaperDim: 0.42,
        wallpaperBlur: 0,
        wallpaperSaturation: 0.88,
      },
      updatedAt: timestamp,
    });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to write Store showcase"));
    });
    database.close();
  });
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
    worker = await extensionWorker(context);
    extensionId = new URL(worker.url()).hostname;
    await expect.poll(() => worker.evaluate(() => Boolean(globalThis.chrome?.runtime?.id)), { timeout: 15_000 }).toBe(true);
    context.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`); });
  });

  test.afterAll(async () => { await context.close(); });

  test("shows a localized, non-blocking first-use hint once and keeps it within a 1280×720 viewport", async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    const hint = page.locator(".launcher-discovery");
    await expect(hint).toBeVisible();
    const bounds = await hint.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
    await hint.getByRole("button", { name: "Скрыть подсказку" }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".launcher-discovery")).toHaveCount(0);
    await page.close();
  });

  test("loads the unpacked MV3 worker with least privilege", async () => {
    const probe = await worker.evaluate(async () => ({ manifest: chrome.runtime.getManifest(), commands: await chrome.commands.getAll() }));
    expect(probe.manifest.manifest_version).toBe(3);
    expect(probe.manifest.chrome_url_overrides?.newtab).toBe("newtab.html");
    expect(probe.manifest.action?.default_popup).toBe("popup.html");
    expect(new Set(probe.manifest.permissions)).toEqual(new Set(["activeTab", "alarms", "contextMenus", "favicon", "storage"]));
    expect(probe.manifest.permissions).not.toEqual(expect.arrayContaining(["tabs", "history", "scripting", "webRequest"]));
    expect(probe.manifest.host_permissions ?? []).toEqual([]);
  });

  test("has no serious accessibility violations and honors reduced motion", async () => {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page.locator(".app-shell")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    const reducedDuration = await page.locator(".board").first().evaluate((board) => Number.parseFloat(getComputedStyle(board).transitionDuration));
    expect(reducedDuration).toBeLessThanOrEqual(0.00001);
    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByRole("button", { name: "Открыть меню Asterfold" })).toBeVisible();
    const forcedColorResults = await new AxeBuilder({ page }).analyze();
    expect(forcedColorResults.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    await page.close();
  });

  test("loads all selectable locales without application network requests", async () => {
    const page = await context.newPage();
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (/^https?:/iu.test(request.url())) externalRequests.push(request.url());
    });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    const expectedTitles = {
      de: "Neuer Tab", en: "New Tab", es: "Nueva pestaña", fr: "Nouvel onglet", it: "Nuova scheda",
      kk: "Жаңа қойынды", nl: "Nieuw tabblad", pl: "Nowa karta", pt: "Novo separador", ru: "Новая вкладка",
      tr: "Yeni sekme", uk: "Нова вкладка",
    } as const;
    for (const [locale, title] of Object.entries(expectedTitles)) {
      await setWorkspaceLocale(page, locale);
      await page.reload();
      await expect(page).toHaveTitle(title);
      await expect(page.locator(".app-shell")).toBeVisible();
    }
    expect(externalRequests).toEqual([]);
    await setWorkspaceLocale(page, "en");
    await page.reload();
    await expect(page).toHaveTitle("New Tab");
    await page.close();
  });

  test("shares session Privacy Mode with the popup and clears stale empty-Page destinations", async () => {
    const workspacePage = await context.newPage();
    await workspacePage.goto(`chrome-extension://${extensionId}/newtab.html`);
    await setWorkspaceLocale(workspacePage, "ru");
    await workspacePage.reload();
    await workspacePage.evaluate(async () => {
      await chrome.storage.session.set({ privacySessionEnabled: true });
    });

    const privatePopup = await context.newPage();
    await privatePopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(privatePopup.locator(".tab-preview small")).toHaveText("••••••");
    await expect(privatePopup.getByText("Скрытая закладка", { exact: true })).toBeVisible();
    await privatePopup.close();

    await workspacePage.evaluate(async () => {
      await chrome.storage.session.remove("privacySessionEnabled");
      const request = indexedDB.open("asterfold");
      const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
      });
      const transaction = database.transaction("pages", "readwrite");
      transaction.objectStore("pages").put({
        id: "empty-page",
        userId: null,
        title: "Empty",
        icon: "folder",
        accent: null,
        position: "zzzzzzzzzzzy",
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        deletedBatchId: null,
        version: 1,
      });
      await new Promise<void>((resolvePromise, reject) => {
        transaction.oncomplete = () => resolvePromise();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to create empty Page"));
      });
      database.close();
    });

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.getByLabel("Страница").selectOption("empty-page");
    await expect(popup.getByLabel("Блок")).toHaveValue("");
    await expect(popup.getByRole("button", { name: "Сохранить закладку" })).toBeDisabled();
    await expect(popup.getByText(/нет блока/iu)).toBeVisible();
    await popup.close();
    await workspacePage.close();
  });

  test("revalidates navigation messages in the background", async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "https://user@example.com/private",
      "https://%75ser@example.com/private",
    ]) {
      const response = JSON.parse(await page.evaluate(async (unsafeUrl) => JSON.stringify(await chrome.runtime.sendMessage({
        type: "OPEN_URL",
        url: unsafeUrl,
        mode: "new-tab",
      })), url)) as unknown;
      expect(response).toEqual({ ok: false, code: "UNSAFE_URL" });
    }

    const newTabPromise = context.waitForEvent("page");
    const success = JSON.parse(await page.evaluate(async () => JSON.stringify(await chrome.runtime.sendMessage({
      type: "OPEN_URL",
      url: "https://example.com/#asterfold-new-tab",
      mode: "new-tab",
    })))) as unknown;
    expect(success).toEqual({ ok: true });
    const opened = await newTabPromise;
    await expect(opened).toHaveURL(/https:\/\/example\.com\/#asterfold-new-tab/u);
    await opened.close();

    const newWindowPagePromise = context.waitForEvent("page");
    const newWindow = JSON.parse(await page.evaluate(async () => JSON.stringify(await chrome.runtime.sendMessage({
      type: "OPEN_URL",
      url: "https://example.com/#asterfold-new-window",
      mode: "new-window",
    })))) as unknown;
    expect(newWindow).toEqual({ ok: true });
    const openedWindowPage = await newWindowPagePromise;
    await expect(openedWindowPage).toHaveURL(/https:\/\/example\.com\/#asterfold-new-window/u);
    await openedWindowPage.close();

    const incognito = JSON.parse(await page.evaluate(async () => JSON.stringify(await chrome.runtime.sendMessage({
      type: "OPEN_URL",
      url: "https://example.com/",
      mode: "incognito",
    })))) as unknown;
    expect(incognito).toEqual({ ok: false, code: "INCOGNITO_UNAVAILABLE" });
    await page.close();
  });

  test("persists core flows and fits 100 bookmarks without desktop scroll", async () => {
    const page = await context.newPage();
    const unexpectedFaviconRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("tracker.invalid")) unexpectedFaviconRequests.push(request.url());
    });
    page.on("pageerror", (error) => runtimeErrors.push(`newtab: ${error.message}`));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page.locator(".app-shell")).toBeVisible();
    await setWorkspaceLocale(page, "en");
    await page.reload();
    await expect(page).toHaveTitle("New Tab");
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/icons/new-tab.svg");
    await setWorkspaceLocale(page, "ru");
    await page.reload();
    await expect(page).toHaveTitle("Новая вкладка");
    await expect(page.locator(".app-shell")).not.toHaveClass(/low-power-mode/u);
    await expect(page.getByRole("button", { name: "Открыть меню Asterfold" })).toBeVisible();

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Страницы" }).click();
    await page.getByRole("menuitem", { name: "Создать страницу" }).click();
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

    await page.evaluate(async () => {
      const request = indexedDB.open("asterfold");
      const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
      });
      const transaction = database.transaction("bookmarks", "readwrite");
      const store = transaction.objectStore("bookmarks");
      const bookmarks = await new Promise<Array<Record<string, unknown>>>((resolvePromise, reject) => {
        const getAll = store.getAll();
        getAll.onsuccess = () => resolvePromise(getAll.result as Array<Record<string, unknown>>);
        getAll.onerror = () => reject(getAll.error ?? new Error("Unable to read bookmarks"));
      });
      const bookmark = bookmarks.find((item) => item.title === "Playwright docs");
      if (!bookmark) throw new Error("Seed bookmark is missing");
      store.put({ ...bookmark, url: "javascript:alert(1)", normalizedUrl: "javascript:alert(1)", faviconUrl: "https://tracker.invalid/favicon.ico", customIcon: "https://tracker.invalid/custom.svg" });
      await new Promise<void>((resolvePromise, reject) => {
        transaction.oncomplete = () => resolvePromise();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to poison bookmark fixture"));
      });
      database.close();
    });
    await page.reload();
    await expect(page.getByText("Playwright docs", { exact: true })).toBeVisible();
    expect(unexpectedFaviconRequests).toEqual([]);
    await page.getByRole("button", { name: "Playwright docs" }).click();
    await expect(page).toHaveURL(new RegExp(`^chrome-extension://${extensionId}/newtab\\.html`, "u"));
    await expect(page.getByText("Небезопасная ссылка заблокирована", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const request = indexedDB.open("asterfold");
      const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
      });
      const transaction = database.transaction("bookmarks", "readwrite");
      const store = transaction.objectStore("bookmarks");
      const bookmarks = await new Promise<Array<Record<string, unknown>>>((resolvePromise, reject) => {
        const getAll = store.getAll();
        getAll.onsuccess = () => resolvePromise(getAll.result as Array<Record<string, unknown>>);
        getAll.onerror = () => reject(getAll.error ?? new Error("Unable to read bookmarks"));
      });
      const bookmark = bookmarks.find((item) => item.title === "Playwright docs");
      if (!bookmark) throw new Error("Seed bookmark is missing");
      store.put({ ...bookmark, url: "https://playwright.dev/docs/chrome-extensions", normalizedUrl: "https://playwright.dev/docs/chrome-extensions" });
      await new Promise<void>((resolvePromise, reject) => {
        transaction.oncomplete = () => resolvePromise();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to restore bookmark fixture"));
      });
      database.close();
    });

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
    const sourceMenu = page.locator(".context-menu");
    await expect(sourceMenu).toBeVisible();
    const sourceMenuBounds = await sourceMenu.evaluate((menu) => {
      const rect = menu.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + 4, rect.top + 4);
      const style = getComputedStyle(menu);
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, isTopmost: target === menu || menu.contains(target), background: style.backgroundColor, color: style.color, zIndex: style.zIndex };
    });
    expect(sourceMenuBounds).toMatchObject({ isTopmost: true, background: "rgb(251, 251, 252)", color: "rgb(25, 26, 29)", zIndex: "2147483647" });
    expect(sourceMenuBounds.left).toBeGreaterThanOrEqual(8);
    expect(sourceMenuBounds.top).toBeGreaterThanOrEqual(8);
    expect(sourceMenuBounds.right).toBeLessThanOrEqual(1440 - 8);
    expect(sourceMenuBounds.bottom).toBeLessThanOrEqual(900 - 8);
    await page.getByRole("menuitem", { name: "Переместить", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Назначение").selectOption({ label: "Later" });
    await dialog.getByRole("button", { name: "Переместить", exact: true }).click();
    await expect(target.getByText("Playwright docs", { exact: true })).toBeVisible();
    await page.reload();
    await expect(target.getByText("Playwright docs", { exact: true })).toBeVisible();
    if (captureScreenshots) {
      await seedStoreShowcase(page);
      await page.reload();
      await expect(page.getByText("Playwright docs", { exact: true })).toBeVisible();
    }
    await captureStoreScreenshot(page, "01-workspace-1280x800.png");

    await page.keyboard.press("Control+K");
    dialog = page.getByRole("dialog");
    await expect(dialog.locator(".search-palette__input")).toHaveCSS("border-radius", "15px");
    await expect(dialog.locator(".search-state")).toHaveCSS("border-radius", "17px");
    if (captureScreenshots) {
      await dialog.getByPlaceholder(/Название, URL/u).fill("design");
      await expect(dialog.getByRole("button", { name: /Design system/u })).toBeVisible();
    }
    await captureStoreScreenshot(page, "02-search-1280x800.png");
    await dialog.getByPlaceholder(/Название, URL/u).fill("playwrite");
    await expect(dialog.getByRole("button", { name: /Playwright docs/u })).toBeVisible();
    await page.keyboard.press("Escape");

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Включить приватность" }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/privacy-mode/u);
    await expect(page.getByText("Playwright docs", { exact: true })).toHaveCount(0);
    await expect(page.locator('[title*="Playwright docs"]')).toHaveCount(0);
    const privateBookmark = page.getByRole("button", { name: "Открыть скрытую закладку" }).first();
    await expect(privateBookmark).toBeVisible();
    await captureStoreScreenshot(page, "04-privacy-1280x800.png");
    await privateBookmark.click({ button: "right" });
    await expect(page.getByRole("menu", { name: "Действия скрытой закладки" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Копировать URL" })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: "Копировать Markdown" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Выключить приватность" }).click();

    if (captureScreenshots) await dismissToasts(page);
    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Настройки" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const lowPowerToggle = dialog.locator('label.switch:has(input[aria-label="Режим для слабых ПК"])');
    await expect(lowPowerToggle).toHaveCount(1);
    await lowPowerToggle.scrollIntoViewIfNeeded();
    await captureStoreScreenshot(page, "03-settings-1280x800.png");
    await lowPowerToggle.click();
    await expect(page.locator(".app-shell")).toHaveClass(/low-power-mode/u);
    await lowPowerToggle.click();
    await expect(page.locator(".app-shell")).not.toHaveClass(/low-power-mode/u);
    await dialog.getByRole("button", { name: "Язык" }).click();
    await dialog.getByRole("button", { name: "Қазақша" }).click();
    await expect(page).toHaveTitle("Жаңа қойынды");
    await dialog.getByRole("button", { name: "Тіл", exact: true }).click();
    await dialog.getByRole("button", { name: "Русский" }).click();
    await dialog.getByRole("button", { name: "Данные и приватность" }).click();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Резервная копия JSON/u }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/^asterfold-backup-v3-\d{4}-\d{2}-\d{2}\.json$/u);
    await dialog.getByRole("button", { name: "Закрыть" }).click();

    await page.getByRole("button", { name: "Playwright docs" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "В корзину" }).click();
    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Корзина" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator(".trash-row")).toHaveCSS("border-radius", "14px");
    await captureStoreScreenshot(page, "05-trash-1280x800.png");
    await dialog.getByRole("button", { name: "Восстановить" }).click();
    await dialog.getByRole("button", { name: "Закрыть" }).click();
    await expect(page.getByText("Playwright docs", { exact: true })).toBeVisible();

    await openLauncher(page);
    await page.getByRole("menuitem", { name: "Корзина" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator(".trash-empty")).toHaveCSS("border-radius", "18px");
    await dialog.getByRole("button", { name: "Закрыть" }).click();

    await setWorkspaceThemeMode(page, "dark");
    await page.reload();
    await page.getByRole("button", { name: "Playwright docs" }).click({ button: "right" });
    await expect(page.locator(".context-menu")).toHaveCSS("background-color", "rgb(37, 39, 43)");
    await expect(page.locator(".context-menu")).toHaveCSS("color", "rgb(245, 245, 246)");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Playwright docs" }).click();
    await expect(page).toHaveURL("https://playwright.dev/docs/chrome-extensions");
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page.getByText("Playwright docs", { exact: true })).toBeVisible();

    await seedScaleFixture(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await expect(page.locator(".bookmark-card")).toHaveCount(100);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const boardCount = await page.locator(".board").count();
    const bottomBoard = page.locator(".board").nth(boardCount - 1);
    await bottomBoard.click({ button: "right", position: { x: 8, y: 8 } });
    const cornerMenuBounds = await page.locator(".context-menu").evaluate((menu) => {
      const rect = menu.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + 4, rect.top + 4);
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, isTopmost: target === menu || menu.contains(target) };
    });
    expect(cornerMenuBounds).toMatchObject({ isTopmost: true });
    expect(cornerMenuBounds.left).toBeGreaterThanOrEqual(8);
    expect(cornerMenuBounds.top).toBeGreaterThanOrEqual(8);
    expect(cornerMenuBounds.right).toBeLessThanOrEqual(1280 - 8);
    expect(cornerMenuBounds.bottom).toBeLessThanOrEqual(720 - 8);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1672, height: 941 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(runtimeErrors).toEqual([]);
    await page.close();
  });
});
