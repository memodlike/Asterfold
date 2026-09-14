import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { ensureStarterWorkspace } from "../src/db/repository";
import { parseSafeNavigationUrl } from "../src/domain/urls";
import { parseExtensionMessage, type ExtensionResponse } from "../src/browser/messages";

function runTask(task: Promise<unknown>, area: string): void {
  void task.catch(() => console.error(`Asterfold background task failed: ${area}`));
}

async function openWorkspace(pageId?: string): Promise<void> {
  const query = pageId ? `?page=${encodeURIComponent(pageId)}` : "";
  await browser.tabs.create({ url: chrome.runtime.getURL(`/newtab.html${query}`) });
}

async function handleRuntimeMessage(raw: unknown, sender: chrome.runtime.MessageSender): Promise<ExtensionResponse> {
  const message = parseExtensionMessage(raw);
  if (!message) return { ok: false, code: "INVALID_MESSAGE" };
  switch (message.type) {
    case "OPEN_WORKSPACE":
      await openWorkspace(message.pageId);
      return { ok: true };
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
    case "DATA_CHANGED":
      return { ok: true };
    default:
      return { ok: false, code: "UNSUPPORTED_MESSAGE" };
  }
}

export default defineBackground(() => {
  runTask(ensureStarterWorkspace(), "initialize");

  browser.runtime.onInstalled.addListener(() => {
    runTask(ensureStarterWorkspace(), "installed");
  });
  browser.runtime.onStartup.addListener(() => {
    runTask(ensureStarterWorkspace(), "startup");
  });

  chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (sender.id !== undefined && sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, code: "EXTERNAL_SENDER_REJECTED" } satisfies ExtensionResponse);
      return false;
    }
    handleRuntimeMessage(raw, sender).then(sendResponse).catch(() => {
      sendResponse({ ok: false, code: "MESSAGE_FAILED" } satisfies ExtensionResponse);
    });
    return true;
  });
});
