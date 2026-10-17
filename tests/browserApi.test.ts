import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: mocks.sendMessage },
  },
}));

import { ExtensionRequestError, faviconUrl, openUrl, openUrls } from "../src/browser/api";

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

  it.each(["new-tabs", "new-window"] as const)(
    "sends %s openUrls navigation to the background",
    async (mode) => {
      await openUrls(["HTTPS://Example.com:443/docs?q=1", "https://google.com/"], mode);
      expect(mocks.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_URLS",
        urls: ["https://example.com/docs?q=1", "https://google.com/"],
        mode,
      });
    },
  );

  it("rejects openUrls when empty or exceeding 50 URLs", async () => {
    await expect(openUrls([], "new-tabs")).rejects.toMatchObject({
      code: "INVALID_MESSAGE",
    });
    const tooMany = Array.from({ length: 51 }, (_, i) => `https://example.com/${i}`);
    await expect(openUrls(tooMany, "new-tabs")).rejects.toMatchObject({
      code: "INVALID_MESSAGE",
    });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("blocks poisoned or mailto URLs in openUrls before sending runtime message", async () => {
    await expect(openUrls(["https://example.com", "javascript:alert(1)"], "new-tabs")).rejects.toMatchObject({
      code: "UNSAFE_URL",
    });
    await expect(openUrls(["mailto:test@example.com"], "new-window")).rejects.toMatchObject({
      code: "UNSAFE_URL",
    });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("never constructs remote favicon URLs or discloses hostnames to Google", () => {
    expect(faviconUrl("HTTPS://GitHub.com:443/path?q=one two", 16, 2)).toBe("");
    expect(faviconUrl("https://figma.com", 48, 2)).toBe("");
  });

  it.each([
    "", "   ", undefined as unknown as string, "not a url",
    "javascript:alert(1)", "data:text/html,unsafe", "file:///private/secret",
    "mailto:test@example.com", "chrome://settings", "chrome-extension://other/page.html",
  ])("does not build a favicon URL for unsupported or unsafe input: %s", (url) => {
    expect(faviconUrl(url, 16, 1)).toBe("");
  });

  it.each([
    "https://github.com", "https://youtube.com", "https://google.com", "https://figma.com",
    "https://linkedin.com", "https://pinterest.com", "https://intranet.example", "http://localhost:3000",
  ])("does not make remote icon requests or disclose bookmark URL: %s", (url) => {
    expect(faviconUrl(url, 16, 1)).toBe("");
  });
});

