import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { createBookmark, ensureStarterWorkspace, getWorkspaceData, purgeTrash } from "../src/db/repository";
import { DuplicateError } from "../src/domain/errors";
import { parseSafeNavigationUrl } from "../src/domain/urls";
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
  let safeUrl: string;
  try {
    safeUrl = parseSafeNavigationUrl(url, { allowMailto: true });
  } catch {
    return { ok: false, code: "UNSAFE_URL" };
  }
  const workspace = await getWorkspaceData();
  const boardId = workspace.settings.quickSaveDefaultBoardId
    ?? workspace.settings.quickSaveLastBoardId
    ?? workspace.boards[0]?.id;
  if (!boardId) return { ok: false, code: "BOARD_REQUIRED" };
  try {
    const fallbackTitle = safeUrl.startsWith("mailto:") ? "Email" : new URL(safeUrl).hostname;
    await createBookmark({ boardId, title: title || fallbackTitle, url: safeUrl, faviconUrl }, { allowDuplicate: workspace.settings.duplicateStrategy === "allow" });
    await setBadge("✓", "#079455");
    return { ok: true, data: { status: "saved" } };
  } catch (error) {
    if (error instanceof DuplicateError) {
      await setBadge("=", "#b7791f");
      return { ok: false, code: "DUPLICATE_BOOKMARK" };
    }
    await setBadge("!", "#d92d20");
    return { ok: false, code: "SAVE_FAILED" };
  }
}

async function saveActiveTab(tabId?: number): Promise<ExtensionResponse> {
  const tabs = tabId === undefined ? await browser.tabs.query({ active: true, currentWindow: true }) : [await browser.tabs.get(tabId)];
  const tab = tabs[0];
  if (!tab?.url) return { ok: false, code: "ACTIVE_TAB_UNAVAILABLE" };
  return saveUrl(tab.url, tab.title ?? "Untitled page", tab.favIconUrl ?? null);
}

async function openWorkspace(pageId?: string): Promise<void> {
  const query = pageId ? `?page=${encodeURIComponent(pageId)}` : "";
  await browser.tabs.create({ url: chrome.runtime.getURL(`/newtab.html${query}`) });
}

async function handleRuntimeMessage(raw: unknown, sender: chrome.runtime.MessageSender): Promise<ExtensionResponse> {
  const message = parseExtensionMessage(raw);
  if (!message) return { ok: false, code: "INVALID_MESSAGE" };
  switch (message.type) {
    case "QUICK_SAVE": return saveActiveTab(message.tabId);
    case "INSTANT_SAVE": return saveUrl(message.url, message.title, message.faviconUrl ?? null);
    case "OPEN_WORKSPACE": await openWorkspace(message.pageId); return { ok: true };
    case "OPEN_URL": {
      let safeUrl: string;
      try {
        safeUrl = parseSafeNavigationUrl(message.url, { allowMailto: true });
      } catch {
        return { ok: false, code: "UNSAFE_URL" };
      }
      if (message.mode === "new-tab") await browser.tabs.create({ url: safeUrl, active: true });
      else if (message.mode === "new-window") await browser.windows.create({ url: safeUrl, focused: true });
      else if (message.mode === "incognito") {
        if (!await browser.extension.isAllowedIncognitoAccess()) return { ok: false, code: "INCOGNITO_UNAVAILABLE" };
        try {
          await browser.windows.create({ url: safeUrl, incognito: true, focused: true });
        } catch {
          return { ok: false, code: "INCOGNITO_UNAVAILABLE" };
        }
      } else if (sender.tab?.id !== undefined) await browser.tabs.update(sender.tab.id, { url: safeUrl });
      else await browser.tabs.update({ url: safeUrl });
      return { ok: true };
    }
    case "GET_SYNC_STATUS": {
      if (!CLOUD_ENABLED) return { ok: true, data: { status: "disabled", pending: 0 } };
      const { getSyncStatus } = await import("../src/sync/engine");
      return { ok: true, data: await getSyncStatus() };
    }
    case "SYNC_NOW": {
      if (!CLOUD_ENABLED) return { ok: false, code: "CLOUD_DISABLED" };
      const { runSync } = await import("../src/sync/engine");
      const result = await runSync();
      return result.status === "idle" ? { ok: true, data: result } : { ok: false, code: "MESSAGE_FAILED" };
    }
    case "DATA_CHANGED": {
      if (message.entity === "settings") await ensureMenus();
      return { ok: true };
    }
    default: return { ok: false, code: "UNSUPPORTED_MESSAGE" };
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
    if (info.menuItemId === MENU_SAVE_LINK && info.linkUrl) {
      let title = info.selectionText?.trim() || "Link";
      try {
        const safeUrl = parseSafeNavigationUrl(info.linkUrl, { allowMailto: true });
        if (!info.selectionText?.trim()) title = safeUrl.startsWith("mailto:") ? "Email" : new URL(safeUrl).hostname;
      } catch {
        return;
      }
      void saveUrl(info.linkUrl, title, null);
      return;
    }
    if (info.menuItemId === MENU_SAVE_PAGE) {
      const url = tab?.url ?? info.pageUrl;
      if (url) void saveUrl(url, tab?.title ?? new URL(url).hostname, tab?.favIconUrl ?? null);
    }
  });

  chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (sender.id !== undefined && sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, code: "EXTERNAL_SENDER_REJECTED" } satisfies ExtensionResponse);
      return false;
    }
    void handleRuntimeMessage(raw, sender).then(sendResponse).catch(() => {
      sendResponse({ ok: false, code: "MESSAGE_FAILED" } satisfies ExtensionResponse);
    });
    return true;
  });
});
