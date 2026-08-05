import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  remove: vi.fn(),
  getTree: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    permissions: { request: mocks.request, remove: mocks.remove },
    bookmarks: { getTree: mocks.getTree },
  },
}));

import { readChromeBookmarks } from "../src/features/onboarding/chromeBookmarkImport";

describe("onboarding Chrome bookmark permission", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.remove.mockReset();
    mocks.getTree.mockReset();
    mocks.request.mockResolvedValue(true);
    mocks.remove.mockResolvedValue(true);
    mocks.getTree.mockResolvedValue([{ id: "root", title: "", children: [{ id: "a", title: "Example", url: "https://example.com" }] }]);
  });

  it("does not touch the Chrome API until the explicit reader action is invoked", () => {
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.getTree).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("requests only the optional bookmarks permission", async () => {
    await readChromeBookmarks();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith({ permissions: ["bookmarks"] });
  });

  it("treats permission denial as a recoverable result and never reads data", async () => {
    mocks.request.mockResolvedValue(false);
    await expect(readChromeBookmarks()).resolves.toEqual({ status: "denied", records: [], permissionRemoved: false });
    expect(mocks.getTree).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("reads the tree after grant and removes the optional permission", async () => {
    await expect(readChromeBookmarks()).resolves.toEqual({
      status: "granted",
      records: [{ title: "Example", url: "https://example.com", description: null, folderPath: [] }],
      permissionRemoved: true,
    });
    expect(mocks.getTree).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith({ permissions: ["bookmarks"] });
    expect(mocks.request.mock.invocationCallOrder[0]).toBeLessThan(mocks.getTree.mock.invocationCallOrder[0]!);
    expect(mocks.getTree.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]!);
  });

  it("supports an explicit policy to retain permission for a continuing workflow", async () => {
    const result = await readChromeBookmarks(false);
    expect(result.status).toBe("granted");
    expect(result.permissionRemoved).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("attempts permission cleanup when bookmark reading fails", async () => {
    mocks.getTree.mockRejectedValue(new Error("Chrome API unavailable"));
    await expect(readChromeBookmarks()).rejects.toThrow("Chrome API unavailable");
    expect(mocks.remove).toHaveBeenCalledWith({ permissions: ["bookmarks"] });
  });

  it("does not convert cleanup refusal into an import failure", async () => {
    mocks.remove.mockResolvedValue(false);
    await expect(readChromeBookmarks()).resolves.toMatchObject({ status: "granted", permissionRemoved: false });
  });
});
