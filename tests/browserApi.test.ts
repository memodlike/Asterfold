import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: mocks.sendMessage },
  },
}));

import { ExtensionRequestError, faviconUrl, openUrl } from "../src/browser/api";

describe("background navigation client", () => {
  beforeEach(() => {
    mocks.sendMessage.mockReset();
    mocks.sendMessage.mockResolvedValue({ ok: true });
  });

  it.each(["current", "new-tab", "new-window", "incognito"] as const)(
    "sends %s navigation to the background",
    async (mode) => {
      await openUrl("HTTPS://Example.com:443/docs?q=1", mode);
      expect(mocks.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_URL",
        url: "https://example.com/docs?q=1",
        mode,
      });
    },
  );

  it("blocks poisoned URLs before sending a runtime message", async () => {
    await expect(openUrl("https://user@example.com/private", "current")).rejects.toMatchObject({
      code: "UNSAFE_URL",
    });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("returns a stable error code instead of a raw Chrome error", async () => {
    mocks.sendMessage.mockResolvedValue({ ok: false, code: "INCOGNITO_UNAVAILABLE" });
    await expect(openUrl("https://example.com", "incognito")).rejects.toBeInstanceOf(ExtensionRequestError);
    await expect(openUrl("https://example.com", "incognito")).rejects.toMatchObject({
      code: "INCOGNITO_UNAVAILABLE",
    });
  });

  it("builds Chrome-owned favicon URLs with normalized DPR-aware resource sizes", () => {
    const getURL = vi.fn((path: string) => `chrome-extension://test-extension${path}`);
    vi.stubGlobal("chrome", { runtime: { getURL } });

    const icon = new URL(faviconUrl("HTTPS://GitHub.com:443/path?q=one two", 16, 2));
    expect(icon.protocol).toBe("chrome-extension:");
    expect(icon.hostname).toBe("test-extension");
    expect(icon.pathname).toBe("/_favicon/");
    expect(icon.searchParams.get("pageUrl")).toBe("https://github.com/path?q=one%20two");
    expect(icon.searchParams.get("size")).toBe("32");
    expect(faviconUrl("https://figma.com", 48, 2)).toContain("size=64");
    expect(getURL).toHaveBeenCalledWith("/_favicon/");
  });

  it("handles DPR scaling and boundary clamping accurately", () => {
    const getURL = vi.fn((path: string) => `chrome-extension://test-extension${path}`);
    vi.stubGlobal("chrome", { runtime: { getURL } });

    // 16px @ 1x DPR -> 16
    expect(new URL(faviconUrl("https://example.com", 16, 1)).searchParams.get("size")).toBe("16");
    // 16px @ 2x DPR -> 32
    expect(new URL(faviconUrl("https://example.com", 16, 2)).searchParams.get("size")).toBe("32");
    // 18px @ 2x DPR = 36 -> nearest is 32 or 48
    expect(new URL(faviconUrl("https://example.com", 18, 2)).searchParams.get("size")).toBe("32");
    // 24px @ 2x DPR = 48 -> 48
    expect(new URL(faviconUrl("https://example.com", 24, 2)).searchParams.get("size")).toBe("48");
    // 32px @ 2x DPR = 64 -> 64
    expect(new URL(faviconUrl("https://example.com", 32, 2)).searchParams.get("size")).toBe("64");
    // Clamping large sizes (>64) to 64
    expect(new URL(faviconUrl("https://example.com", 128, 2)).searchParams.get("size")).toBe("64");
    // Clamping small sizes (<16) to 16
    expect(new URL(faviconUrl("https://example.com", 8, 1)).searchParams.get("size")).toBe("16");
  });

  it.each([
    "", "   ", undefined as unknown as string, "not a url",
    "javascript:alert(1)", "data:text/html,unsafe", "file:///private/secret",
    "mailto:test@example.com", "chrome://settings", "chrome-extension://other/page.html",
  ])("does not build a favicon URL for unsupported or unsafe input: %s", (url) => {
    expect(faviconUrl(url, 16, 1)).toBe("");
  });

  it("rejects non-finite, zero, or negative dimensions and DPR", () => {
    const getURL = vi.fn((path: string) => `chrome-extension://test-extension${path}`);
    vi.stubGlobal("chrome", { runtime: { getURL } });

    expect(faviconUrl("https://example.com", Number.NaN, 1)).toBe("");
    expect(faviconUrl("https://example.com", Number.POSITIVE_INFINITY, 1)).toBe("");
    expect(faviconUrl("https://example.com", 16, Number.NaN)).toBe("");
    expect(faviconUrl("https://example.com", 16, Number.NEGATIVE_INFINITY)).toBe("");
    expect(faviconUrl("https://example.com", 0, 1)).toBe("");
    expect(faviconUrl("https://example.com", -16, 1)).toBe("");
    expect(faviconUrl("https://example.com", 16, 0)).toBe("");
    expect(faviconUrl("https://example.com", 16, -1)).toBe("");
  });

  it("returns empty string when browser runtime is unavailable", () => {
    vi.stubGlobal("chrome", undefined);
    expect(faviconUrl("https://example.com", 16, 1)).toBe("");
  });

  it.each([
    "https://github.com", "https://youtube.com", "https://google.com", "https://figma.com",
    "https://linkedin.com", "https://pinterest.com", "https://intranet.example", "http://localhost:3000",
  ])("uses Chrome-owned favicon resource for supported bookmark URL: %s", (url) => {
    const getURL = vi.fn((path: string) => `chrome-extension://test-extension${path}`);
    vi.stubGlobal("chrome", { runtime: { getURL } });

    const icon = new URL(faviconUrl(url, 16, 1));
    expect(icon.protocol).toBe("chrome-extension:");
    expect(icon.pathname).toBe("/_favicon/");
    expect(icon.searchParams.get("pageUrl")).toBe(new URL(url).toString());
    expect(icon.searchParams.get("size")).toBe("16");
  });
});

