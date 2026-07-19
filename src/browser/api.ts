import { browser } from "wxt/browser";
import type { BookmarkOpenMode } from "../domain/models";
import { isSafeOpenUrl } from "../domain/urls";

export function faviconUrl(pageUrl: string, size = 32): string {
  if (!isSafeOpenUrl(pageUrl) || pageUrl.startsWith("mailto:")) return "";
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`);
}

export async function openUrl(url: string, mode: BookmarkOpenMode): Promise<void> {
  if (!isSafeOpenUrl(url)) throw new Error("Unsafe URL blocked");
  if (mode === "current") {
    window.location.assign(url);
    return;
  }
  if (mode === "new-tab") {
    await browser.tabs.create({ url, active: true });
    return;
  }
  if (mode === "new-window") {
    await browser.windows.create({ url, focused: true });
    return;
  }
  await browser.windows.create({ url, incognito: true, focused: true });
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export async function openWorkspace(pageId?: string): Promise<void> {
  const url = chrome.runtime.getURL(`/newtab.html${pageId ? `?page=${encodeURIComponent(pageId)}` : ""}`);
  await browser.tabs.create({ url });
}
