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

const CHROME_FAVICON_SIZES = [16, 32, 48, 64] as const;

function nearestChromeFaviconSize(requestedSize: number): number {
  const bounded = Math.min(64, Math.max(16, requestedSize));
  return CHROME_FAVICON_SIZES.reduce((nearest, candidate) => (
    Math.abs(candidate - bounded) < Math.abs(nearest - bounded) ? candidate : nearest
  ));
}

export function faviconUrl(pageUrl?: string, cssSize = 16, devicePixelRatio = globalThis.devicePixelRatio || 1): string {
  if (!pageUrl || !Number.isFinite(cssSize) || !Number.isFinite(devicePixelRatio)) return "";
  try {
    const safeUrl = parseSafeNavigationUrl(pageUrl);
    const resourceSize = nearestChromeFaviconSize(Math.ceil(cssSize * Math.max(1, devicePixelRatio)));
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", safeUrl);
    url.searchParams.set("size", String(resourceSize));
    return url.toString();
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
