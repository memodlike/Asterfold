import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tabsCreate: vi.fn(),
  windowsCreate: vi.fn(),
  tabsUpdate: vi.fn(),
  isAllowedIncognitoAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    tabs: { create: mocks.tabsCreate, update: mocks.tabsUpdate },
    windows: { create: mocks.windowsCreate },
    extension: { isAllowedIncognitoAccess: mocks.isAllowedIncognitoAccess },
  },
}));

vi.mock("wxt/utils/define-background", () => ({
  defineBackground: (fn: () => void) => fn,
}));

vi.mock("../src/db/repository", () => ({
  ensureStarterWorkspace: vi.fn().mockResolvedValue(undefined),
  purgeTrash: vi.fn().mockResolvedValue(0),
}));

import { handleRuntimeMessage } from "../entrypoints/background";

describe("background OPEN_URLS handler", () => {
  const dummySender: chrome.runtime.MessageSender = {
    id: "asterfold-ext-id",
    tab: { id: 1 } as chrome.tabs.Tab,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tabsCreate.mockResolvedValue({});
    mocks.windowsCreate.mockResolvedValue({});
  });

  it("opens N inactive tabs in order in new-tabs mode", async () => {
    const urls = [
      "https://example.com/first",
      "https://example.com/second",
      "https://example.com/third",
    ];

    const response = await handleRuntimeMessage(
      { type: "OPEN_URLS", urls, mode: "new-tabs" },
      dummySender,
    );

    expect(response).toEqual({ ok: true });
    expect(mocks.tabsCreate).toHaveBeenCalledTimes(3);
    expect(mocks.tabsCreate).toHaveBeenNthCalledWith(1, { url: "https://example.com/first", active: false });
    expect(mocks.tabsCreate).toHaveBeenNthCalledWith(2, { url: "https://example.com/second", active: false });
    expect(mocks.tabsCreate).toHaveBeenNthCalledWith(3, { url: "https://example.com/third", active: false });
    expect(mocks.windowsCreate).not.toHaveBeenCalled();
  });

  it("calls windows.create once with the URL array in new-window mode", async () => {
    const urls = [
      "https://example.com/alpha",
      "https://example.com/beta",
    ];

    const response = await handleRuntimeMessage(
      { type: "OPEN_URLS", urls, mode: "new-window" },
      dummySender,
    );

    expect(response).toEqual({ ok: true });
    expect(mocks.windowsCreate).toHaveBeenCalledOnce();
    expect(mocks.windowsCreate).toHaveBeenCalledWith({
      url: ["https://example.com/alpha", "https://example.com/beta"],
      focused: true,
    });
    expect(mocks.tabsCreate).not.toHaveBeenCalled();
  });

  it("rejects when any URL is unsafe (e.g. javascript:) and creates nothing", async () => {
    const response = await handleRuntimeMessage(
      { type: "OPEN_URLS", urls: ["https://example.com/ok", "javascript:alert(1)"], mode: "new-tabs" },
      dummySender,
    );

    expect(response).toEqual({ ok: false, code: "UNSAFE_URL" });
    expect(mocks.tabsCreate).not.toHaveBeenCalled();
    expect(mocks.windowsCreate).not.toHaveBeenCalled();
  });

  it("rejects mailto: URLs and creates nothing", async () => {
    const response = await handleRuntimeMessage(
      { type: "OPEN_URLS", urls: ["mailto:support@example.com"], mode: "new-window" },
      dummySender,
    );

    expect(response).toEqual({ ok: false, code: "UNSAFE_URL" });
    expect(mocks.tabsCreate).not.toHaveBeenCalled();
    expect(mocks.windowsCreate).not.toHaveBeenCalled();
  });
});
