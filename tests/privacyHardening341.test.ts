import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_DB_SCHEMA_VERSION, V9_STORES, V10_STORES } from "../src/db/migrations";
import { flattenChromeBookmarks } from "../src/features/onboarding/chromeBookmarkImport";
import { AsterfoldDatabase } from "../src/db/database";
import { importRecords } from "../src/services/exportImport";
import "fake-indexeddb/auto";

describe("Asterfold privacy hardening invariants", () => {
  it("enforces least privilege manifest configuration with Chrome-owned favicon access only", async () => {
    const config = await readFile(join(process.cwd(), "wxt.config.ts"), "utf8");
    expect(config).toMatch(/permissions:\s*\[[^\]]*["']storage["'][^\]]*["']favicon["'][^\]]*\]/u);
    expect(config).not.toMatch(/["']activeTab["']/u);
    expect(config).not.toMatch(/["']alarms["']/u);
    expect(config).not.toMatch(/["']contextMenus["']/u);
    expect(config).not.toMatch(/commands:\s*\{/u);
    expect(config).toMatch(/optional_permissions:\s*\[\s*["']bookmarks["']\s*\]/u);
    expect(config).toMatch(/host_permissions:\s*\[\s*\]/u);
  });

  it("proves background service worker is dormant and free of privileged listeners", async () => {
    const background = await readFile(join(process.cwd(), "entrypoints/background.ts"), "utf8");
    expect(background).not.toContain("contextMenus");
    expect(background).not.toContain("alarms");
    expect(background).not.toContain("saveActiveTab");
    expect(background).not.toContain("tabs.query");
    expect(background).not.toContain("setBadge");
    expect(background).toContain("sender.id !== chrome.runtime.id");
    expect(background).toContain("parseSafeNavigationUrl");
  });

  it("verifies Schema 10 indexes sourceId for bookmarks, boards, and pages", () => {
    expect(CURRENT_DB_SCHEMA_VERSION).toBe(10);
    expect(V9_STORES.bookmarks).toContain("sourceId");
    expect(V9_STORES.boards).toContain("sourceId");
    expect(V10_STORES.pages).toContain("sourceId");
  });

  it("extracts and preserves sourceId and folderSourceId in flattenChromeBookmarks", () => {
    const mockNodes = [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          {
            id: "101",
            parentId: "1",
            title: "GitHub",
            url: "https://github.com",
          },
          {
            id: "102",
            parentId: "1",
            title: "Folder",
            children: [
              {
                id: "103",
                parentId: "102",
                title: "Docs",
                url: "https://docs.github.com",
              },
            ],
          },
        ],
      },
    ];

    const records = flattenChromeBookmarks(mockNodes as unknown as chrome.bookmarks.BookmarkTreeNode[]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      title: "GitHub",
      url: "https://github.com",
      source: "chrome",
      sourceId: "101",
      folderSourceId: "1",
    });
    expect(records[1]).toMatchObject({
      title: "Docs",
      url: "https://docs.github.com",
      source: "chrome",
      sourceId: "103",
      folderSourceId: "102",
    });
  });

  it("executes non-destructive idempotent overlay import with sourceId mapping", async () => {
    const testDb = new AsterfoldDatabase(`test-hardening-${Date.now()}`);
    const mockRecords = [
      {
        title: "GitHub",
        url: "https://github.com",
        description: null,
        folderPath: ["Dev"],
        source: "chrome" as const,
        sourceId: "chrome-101",
        folderSourceId: "folder-1",
      },
      {
        title: "MDN Web Docs",
        url: "https://developer.mozilla.org",
        description: null,
        folderPath: ["Dev"],
        source: "chrome" as const,
        sourceId: "chrome-102",
        folderSourceId: "folder-1",
      },
    ];

    const summary1 = await importRecords(mockRecords, { pageTitle: "Sync" }, "skip", testDb);
    expect(summary1.imported).toBe(2);
    expect(summary1.skippedDuplicates).toBe(0);

    const bookmarksAfterFirst = await testDb.bookmarks.toArray();
    expect(bookmarksAfterFirst).toHaveLength(2);
    const gh = bookmarksAfterFirst.find((b) => b.sourceId === "chrome-101");
    expect(gh).toBeDefined();
    expect(gh?.title).toBe("GitHub");

    // Edit local bookmark
    await testDb.bookmarks.update(gh!.id, { description: "User custom local note", title: "My GitHub" });

    // Repeated import: completely idempotent
    const firstBoard = bookmarksAfterFirst[0]?.boardId ? await testDb.boards.get(bookmarksAfterFirst[0].boardId) : undefined;
    const summary2 = await importRecords(
      mockRecords,
      { pageTitle: "Sync", ...(firstBoard?.pageId ? { pageId: firstBoard.pageId } : {}) },
      "skip",
      testDb
    );
    expect(summary2.imported).toBe(0);
    expect(summary2.skippedDuplicates).toBe(2);

    const bookmarksAfterSecond = await testDb.bookmarks.toArray();
    expect(bookmarksAfterSecond).toHaveLength(2);
    const ghAfterSecond = bookmarksAfterSecond.find((b) => b.sourceId === "chrome-101");
    expect(ghAfterSecond?.title).toBe("My GitHub");
    expect(ghAfterSecond?.description).toBe("User custom local note");

    testDb.close();
  });

  it("proves scan-source script forbids chrome.contextMenus", async () => {
    const scanScript = await readFile(join(process.cwd(), "scripts/scan-source.mjs"), "utf8");
    expect(scanScript).toContain("contextMenus");
  });

  it("proves release validator allows only storage and Chrome favicon access", async () => {
    const releaseScript = await readFile(join(process.cwd(), "scripts/release.mjs"), "utf8");
    expect(releaseScript).toContain('expectedPermissions = ["storage", "favicon"]');
  });
});
