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

  it("returns empty string without requesting favicon permissions or network", () => {
    expect(faviconUrl("https://github.com/")).toBe("");
    expect(faviconUrl("https://figma.com", 48, 2)).toBe("");
  });

  it.each(["not a url", "javascript:alert(1)", "data:text/html,unsafe", "file:///private/secret"])(
    "does not build a favicon URL for unsupported input: %s",
    (url) => {
      expect(faviconUrl(url, 16, 1)).toBe("");
    },
  );

  it.each([
    "https://github.com", "https://youtube.com", "https://google.com", "https://figma.com",
    "https://linkedin.com", "https://pinterest.com", "https://intranet.example", "http://localhost:3000",
  ])("returns empty favicon URL for supported bookmark URL to avoid favicon permission: %s", (url) => {
    expect(faviconUrl(url, 16, 1)).toBe("");
  });
});

