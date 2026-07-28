import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

const baselinePath = process.env.ASTERFOLD_UPGRADE_BASELINE_PATH ? resolve(process.env.ASTERFOLD_UPGRADE_BASELINE_PATH) : "";
const targetZip = process.env.ASTERFOLD_UPGRADE_TARGET_ZIP ? resolve(process.env.ASTERFOLD_UPGRADE_TARGET_ZIP) : "";
const profilePath = process.env.ASTERFOLD_UPGRADE_PROFILE_PATH ? resolve(process.env.ASTERFOLD_UPGRADE_PROFILE_PATH) : resolve(".upgrade/profile");
const executablePath = process.env.ASTERFOLD_CHROMIUM_PATH || "/usr/bin/chromium";

test.skip(!baselinePath || !targetZip, "Exact 2.2.3 upgrade fixture is prepared only in CI/release gates.");

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers().find((worker) => worker.url().startsWith("chrome-extension://"))
    ?? context.waitForEvent("serviceworker", { predicate: (worker) => worker.url().startsWith("chrome-extension://"), timeout: 15_000 });
}

async function launch(extensionPath: string): Promise<{ context: BrowserContext; page: Page; extensionId: string; errors: string[] }> {
  const errors: string[] = [];
  const context = await chromium.launchPersistentContext(profilePath, {
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-crash-reporter", "--disable-features=DisableLoadExtensionCommandLineSwitch", `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  context.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  const worker = await extensionWorker(context);
  const extensionId = new URL(worker.url()).hostname;
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);
  await expect(page.locator(".app-shell")).toBeVisible();
  return { context, page, extensionId, errors };
}

async function seedVersion223(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const open = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      open.onsuccess = () => resolvePromise(open.result);
      open.onerror = () => reject(open.error ?? new Error("Unable to open 2.2.3 database"));
    });
    const timestamp = "2026-07-28T12:00:00.000Z";
    const pageRecord = { id: "upgrade-page", userId: null, title: "Upgrade workspace", icon: "folder", accent: "#123456", position: "000000000099", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 3 };
    const boardRecord = { id: "upgrade-board", userId: null, pageId: pageRecord.id, title: "Upgrade board", icon: "briefcase", accent: "#654321", position: "000000000099", collapsed: false, layout: "grid", bookmarkColumns: 2, gridColumn: 4, gridRow: 1, gridSpan: 6, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 2 };
    const bookmarkRecord = { id: "upgrade-bookmark", userId: null, boardId: boardRecord.id, title: "Preserved link", url: "https://example.com/preserved", normalizedUrl: "https://example.com/preserved", hostname: "example.com", description: "Must survive 3.0.0", faviconUrl: null, customIcon: null, position: "000000000099", openMode: "new-window", pinned: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 4 };
    const trashRecord = { ...bookmarkRecord, id: "upgrade-trash", title: "Preserved trash", url: "https://example.com/trash", normalizedUrl: "https://example.com/trash", deletedAt: timestamp, deletedBatchId: "upgrade-batch" };
    const transaction = database.transaction(["pages", "boards", "bookmarks", "settings"], "readwrite");
    transaction.objectStore("pages").put(pageRecord);
    transaction.objectStore("boards").put(boardRecord);
    transaction.objectStore("bookmarks").put(bookmarkRecord);
    transaction.objectStore("bookmarks").put(trashRecord);
    const settingsStore = transaction.objectStore("settings");
    const settings = await new Promise<Record<string, unknown> & { theme: Record<string, unknown> }>((resolvePromise, reject) => {
      const get = settingsStore.get("app");
      get.onsuccess = () => resolvePromise(get.result as Record<string, unknown> & { theme: Record<string, unknown> });
      get.onerror = () => reject(get.error ?? new Error("Unable to read 2.2.3 settings"));
    });
    settingsStore.put({
      ...settings,
      schemaVersion: 5,
      activePageId: pageRecord.id,
      locale: "en",
      workspaceLayoutMode: "free",
      workspaceRows: 1,
      workspaceAlignment: "right",
      quickSaveMode: "instant",
      quickSaveDefaultPageId: pageRecord.id,
      quickSaveDefaultBoardId: boardRecord.id,
      quickSaveLastPageId: pageRecord.id,
      quickSaveLastBoardId: boardRecord.id,
      privacyPersist: true,
      privacyEnabled: true,
      onboardingComplete: false,
      theme: { ...settings.theme, mode: "dark", wallpaperId: "builtin-dusk", backgroundMode: "wallpaper", wallpaperDim: 0.55, wallpaperBlur: 3, wallpaperSaturation: 0.8 },
      updatedAt: timestamp,
    });
    await new Promise<void>((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to seed 2.2.3 database"));
    });
    database.close();
    return { pageRecord, boardRecord, bookmarkRecord, trashRecord };
  });
}

test("preserves a real 2.2.3 profile when the same unpacked extension path is upgraded to 3.0.0", async () => {
  expect(existsSync(`${baselinePath}/manifest.json`)).toBe(true);
  expect(existsSync(targetZip)).toBe(true);
  rmSync(profilePath, { recursive: true, force: true });
  mkdirSync(profilePath, { recursive: true });

  const before = await launch(baselinePath);
  const baselineManifest = await before.page.evaluate(() => chrome.runtime.getManifest());
  expect(baselineManifest.version).toBe("2.2.3");
  const seeded = await seedVersion223(before.page);
  const baselineExtensionId = before.extensionId;
  expect(before.errors).toEqual([]);
  await before.context.close();

  rmSync(baselinePath, { recursive: true, force: true });
  mkdirSync(baselinePath, { recursive: true });
  execFileSync("unzip", ["-q", targetZip, "-d", baselinePath]);

  const after = await launch(baselinePath);
  expect(after.extensionId).toBe(baselineExtensionId);
  const targetManifest = await after.page.evaluate(() => chrome.runtime.getManifest());
  expect(targetManifest.version).toBe("3.0.0");
  const snapshot = await after.page.evaluate(async () => {
    const open = indexedDB.open("asterfold");
    const database = await new Promise<IDBDatabase>((resolvePromise, reject) => {
      open.onsuccess = () => resolvePromise(open.result);
      open.onerror = () => reject(open.error ?? new Error("Unable to open upgraded database"));
    });
    const transaction = database.transaction(["pages", "boards", "bookmarks", "settings"], "readonly");
    const read = <T,>(store: string, key: IDBValidKey): Promise<T> => new Promise((resolvePromise, reject) => {
      const request = transaction.objectStore(store).get(key);
      request.onsuccess = () => resolvePromise(request.result as T);
      request.onerror = () => reject(request.error ?? new Error(`Unable to read ${store}`));
    });
    const result = {
      pageRecord: await read("pages", "upgrade-page"),
      boardRecord: await read("boards", "upgrade-board"),
      bookmarkRecord: await read("bookmarks", "upgrade-bookmark"),
      trashRecord: await read("bookmarks", "upgrade-trash"),
      settings: await read<Record<string, unknown>>("settings", "app"),
      version: database.version,
    };
    database.close();
    return result;
  });

  expect(snapshot.pageRecord).toMatchObject(seeded.pageRecord);
  expect(snapshot.boardRecord).toMatchObject(seeded.boardRecord);
  expect(snapshot.bookmarkRecord).toMatchObject(seeded.bookmarkRecord);
  expect(snapshot.trashRecord).toMatchObject(seeded.trashRecord);
  expect(snapshot.settings).toMatchObject({
    schemaVersion: 6,
    activePageId: "upgrade-page",
    locale: "en",
    workspaceLayoutMode: "free",
    workspaceRows: 1,
    workspaceAlignment: "right",
    quickSaveMode: "instant",
    quickSaveDefaultPageId: "upgrade-page",
    quickSaveDefaultBoardId: "upgrade-board",
    privacyPersist: true,
    privacyEnabled: true,
    onboardingComplete: true,
  });
  expect(snapshot.settings.theme).toMatchObject({ mode: "dark", wallpaperId: "builtin-dusk", backgroundMode: "wallpaper", wallpaperDim: 0.55, wallpaperBlur: 3, wallpaperSaturation: 0.8 });
  await expect(after.page.getByText("Preserved link", { exact: true })).toBeVisible();
  await after.page.keyboard.press("Control+K");
  await after.page.getByPlaceholder(/Title, URL/i).fill("Preserved");
  await expect(after.page.getByRole("button", { name: /Preserved link/i })).toBeVisible();
  await expect(after.page.locator(".launcher-discovery")).toHaveCount(0);
  expect(after.errors).toEqual([]);
  await after.context.close();
});
