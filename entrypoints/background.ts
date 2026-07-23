import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { createBookmark, ensureStarterWorkspace, getWorkspaceData, purgeTrash } from "../src/db/repository";
import { DuplicateError } from "../src/domain/errors";
import { isSafeOpenUrl } from "../src/domain/urls";
import { parseExtensionMessage, type ExtensionResponse } from "../src/browser/messages";
import { translate, type MessageKey } from "../src/i18n";

const MENU_SAVE_PAGE = "asterfold-save-page";
const MENU_SAVE_LINK = "asterfold-save-link";
const MENU_OPEN = "asterfold-open";
const TRASH_ALARM = "asterfold-trash-cleanup";
const CLOUD_ENABLED = import.meta.env.WXT_ENABLE_CLOUD_SYNC === "true";

async function ensureMenus(): Promise<void> {
  const workspace = await getWorkspaceData();
  const t = (key: MessageKey): string => translate(workspace.settings.locale, key);
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({ id: MENU_SAVE_PAGE, title: t("context.savePage"), contexts: ["page"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
  browser.contextMenus.create({ id: MENU_SAVE_LINK, title: t("context.saveLink"), contexts: ["link"], targetUrlPatterns: ["http://*/*", "https://*/*", "mailto:*"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
  browser.contextMenus.create({ id: MENU_OPEN, title: t("context.openWorkspace"), contexts: ["page", "action"] });
}

async function setBadge(text: string, color: string): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
  setTimeout(() => { void browser.action.setBadgeText({ text: "" }); }, 1_800);
}

async function saveUrl(url: string, title: string, faviconUrl: string | null): Promise<ExtensionResponse> {
  if (!isSafeOpenUrl(url)) return { ok: false, message: "This URL cannot be saved" };
  const workspace = await getWorkspaceData();
  const boardId = workspace.settings.quickSaveDefaultBoardId
    ?? workspace.settings.quickSaveLastBoardId
    ?? workspace.boards[0]?.id;
  if (!boardId) return { ok: false, message: "Create a Board before using instant save" };
  try {
    await createBookmark({ boardId, title: title || new URL(url).hostname, url, faviconUrl }, { allowDuplicate: workspace.settings.duplicateStrategy === "allow" });
    await setBadge("✓", "#079455");
    return { ok: true, message: "Saved locally" };
  } catch (error) {
    if (error instanceof DuplicateError) {
      await setBadge("=", "#b7791f");
      return { ok: false, message: "Already saved in the default Board" };
    }
    await setBadge("!", "#d92d20");
    return { ok: false, message: error instanceof Error ? error.message : "Save failed" };
  }
}

async function saveActiveTab(tabId?: number): Promise<ExtensionResponse> {
  const tabs = tabId === undefined ? await browser.tabs.query({ active: true, currentWindow: true }) : [await browser.tabs.get(tabId)];
  const tab = tabs[0];
  if (!tab?.url) return { ok: false, message: "Active tab is unavailable" };
  return saveUrl(tab.url, tab.title ?? "Untitled page", tab.favIconUrl ?? null);
}

async function openWorkspace(pageId?: string): Promise<void> {
  const query = pageId ? `?page=${encodeURIComponent(pageId)}` : "";
  await browser.tabs.create({ url: chrome.runtime.getURL(`/newtab.html${query}`) });
}

async function handleRuntimeMessage(raw: unknown): Promise<ExtensionResponse> {
  const message = parseExtensionMessage(raw);
  if (!message) return { ok: false, message: "Invalid extension message" };
  switch (message.type) {
    case "QUICK_SAVE": return saveActiveTab(message.tabId);
    case "INSTANT_SAVE": return saveUrl(message.url, message.title, message.faviconUrl ?? null);
    case "OPEN_WORKSPACE": await openWorkspace(message.pageId); return { ok: true };
    case "OPEN_URL": {
      if (!isSafeOpenUrl(message.url)) return { ok: false, message: "Unsafe URL blocked" };
      if (message.mode === "new-tab") await browser.tabs.create({ url: message.url });
      else if (message.mode === "new-window") await browser.windows.create({ url: message.url });
      else if (message.mode === "incognito") await browser.windows.create({ url: message.url, incognito: true });
      else await browser.tabs.update({ url: message.url });
      return { ok: true };
    }
    case "GET_SYNC_STATUS": {
      if (!CLOUD_ENABLED) return { ok: true, data: { status: "disabled", pending: 0, message: "Local-only mode" } };
      const { getSyncStatus } = await import("../src/sync/engine");
      return { ok: true, data: await getSyncStatus() };
    }
    case "SYNC_NOW": {
      if (!CLOUD_ENABLED) return { ok: false, message: "Cloud sync is not configured; local data is safe" };
      const { runSync } = await import("../src/sync/engine");
      const result = await runSync();
      return { ok: result.status === "idle", message: result.message, data: result };
    }
    case "DATA_CHANGED": {
      if (message.entity === "settings") await ensureMenus();
      return { ok: true };
    }
    default: return { ok: false, message: "Unsupported message" };
  }
}

export default defineBackground(() => {
  void ensureStarterWorkspace();

  browser.runtime.onInstalled.addListener(() => {
    void ensureMenus();
    void browser.alarms.create(TRASH_ALARM, { delayInMinutes: 5, periodInMinutes: 24 * 60 });
  });
  browser.runtime.onStartup.addListener(() => {
    void ensureMenus();
    void purgeTrash();
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TRASH_ALARM) void purgeTrash();
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== "quick-save") return;
    void getWorkspaceData().then(async (workspace) => {
      if (workspace.settings.quickSaveMode === "instant") {
        await saveActiveTab();
        return;
      }
      try {
        await browser.action.openPopup();
      } catch {
        await openWorkspace();
      }
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_OPEN) { void openWorkspace(); return; }
    if (info.menuItemId === MENU_SAVE_LINK && info.linkUrl && isSafeOpenUrl(info.linkUrl)) {
      void saveUrl(info.linkUrl, info.selectionText?.trim() || new URL(info.linkUrl).hostname, null);
      return;
    }
    if (info.menuItemId === MENU_SAVE_PAGE) {
      const url = tab?.url ?? info.pageUrl;
      if (url) void saveUrl(url, tab?.title ?? new URL(url).hostname, tab?.favIconUrl ?? null);
    }
  });

  chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (sender.id !== undefined && sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, message: "External sender rejected" } satisfies ExtensionResponse);
      return false;
    }
    void handleRuntimeMessage(raw).then(sendResponse).catch((error: unknown) => {
      sendResponse({ ok: false, message: error instanceof Error ? error.message : "Message handling failed" } satisfies ExtensionResponse);
    });
    return true;
  });
});
