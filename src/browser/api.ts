import { browser } from "wxt/browser";
import type { BookmarkOpenMode } from "../domain/models";
import { parseSafeNavigationUrl } from "../domain/urls";
import type { ExtensionErrorCode, ExtensionResponse } from "./messages";

export class ExtensionRequestError extends Error {
  public constructor(
    public readonly code: ExtensionErrorCode,
    public readonly params?: Record<string, string | number>,
  ) {
    super(code);
    this.name = "ExtensionRequestError";
  }
}

export function faviconUrl(pageUrl: string, size = 32): string {
  try {
    const safeUrl = parseSafeNavigationUrl(pageUrl);
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(safeUrl)}&size=${size}`);
  } catch {
    return "";
  }
}

export async function openUrl(url: string, mode: BookmarkOpenMode): Promise<void> {
  let safeUrl: string;
  try {
    safeUrl = parseSafeNavigationUrl(url, { allowMailto: true });
  } catch {
    throw new ExtensionRequestError("UNSAFE_URL");
  }
  const response = await browser.runtime.sendMessage({
    type: "OPEN_URL",
    url: safeUrl,
    mode,
  }) as ExtensionResponse;
  if (!response.ok) throw new ExtensionRequestError(response.code, response.params);
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export async function openWorkspace(pageId?: string): Promise<void> {
  const url = chrome.runtime.getURL(`/newtab.html${pageId ? `?page=${encodeURIComponent(pageId)}` : ""}`);
  await browser.tabs.create({ url });
}
