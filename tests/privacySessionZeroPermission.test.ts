import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock wxt/browser with zero permissions (no storage API)
vi.mock("wxt/browser", () => ({
  browser: {},
}));

import { readSessionPrivacy, subscribeSessionPrivacy, writeSessionPrivacy } from "../src/browser/privacySession";

describe("zero-permission session Privacy Mode cross-context synchronization", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("shares session privacy flag across simulated contexts via web storage", async () => {
    // Context A writes privacy mode = true
    await writeSessionPrivacy(true);

    // Context B (e.g. popup) reads session privacy
    const popupSessionValue = await readSessionPrivacy();
    expect(popupSessionValue).toBe(true);

    // Context A disables privacy mode
    await writeSessionPrivacy(false);

    // Context B reads again
    const popupSessionValueAfter = await readSessionPrivacy();
    expect(popupSessionValueAfter).toBe(false);
  });

  it("notifies subscribers when session privacy state changes without chrome.storage", async () => {
    const received: boolean[] = [];
    const unsubscribe = subscribeSessionPrivacy((enabled) => {
      received.push(enabled);
    });

    try {
      await writeSessionPrivacy(true);
      await writeSessionPrivacy(false);

      expect(received).toContain(true);
      expect(received).toContain(false);
    } finally {
      unsubscribe();
    }
  });
});
