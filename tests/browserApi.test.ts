import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: mocks.sendMessage },
  },
}));

import { ExtensionRequestError, openUrl } from "../src/browser/api";

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
});
