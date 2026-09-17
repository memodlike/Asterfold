import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { AsterfoldDatabase } from "../src/db/database";
import { ensureStarterWorkspace, renamePage, updateBoard, updateBookmark } from "../src/db/repository";
import { importRecords, parseNetscapeHtml, type ImportRecord } from "../src/services/exportImport";
import { parseExtensionMessage } from "../src/browser/messages";
import "fake-indexeddb/auto";

describe("Asterfold 3.5.2 Audit Remediation Suite", () => {
  describe("AF-DATA-001: Chrome refresh idempotency and machine-readable destination Page", () => {
    it("satisfies all idempotency invariants across repeated Chrome refreshes without pageId", async () => {
      const dbName = `test-af-data-001-${crypto.randomUUID()}`;
      const db = new AsterfoldDatabase(dbName);
      await db.open();
      await ensureStarterWorkspace(db);

      const initialPages = await db.pages.filter((p) => p.deletedAt === null).toArray();
      expect(initialPages).toHaveLength(1);

      const chromeRecords: ImportRecord[] = [
        {
          title: "GitHub Portal",
          url: "https://github.com/",
          description: "Developer platform",
          folderPath: ["Development"],
          source: "chrome",
          sourceId: "chrome-bm-101",
          folderSourceId: "chrome-fld-dev",
        },
        {
          title: "Mozilla MDN",
          url: "https://developer.mozilla.org/",
          description: "Web documentation",
          folderPath: ["Development"],
          source: "chrome",
          sourceId: "chrome-bm-102",
          folderSourceId: "chrome-fld-dev",
        },
      ];

      // First Chrome import (Settings-level flow: no pageId provided)
      const firstSummary = await importRecords(
        chromeRecords,
        { pageTitle: "Chrome import", source: "chrome", sourceId: "chrome" },
        "skip",
        db,
      );

      expect(firstSummary.imported).toBe(2);
      expect(firstSummary.skippedDuplicates).toBe(0);

      const pagesAfterFirst = await db.pages.filter((p) => p.deletedAt === null).toArray();
      expect(pagesAfterFirst).toHaveLength(2);
      const chromePage = pagesAfterFirst.find((p) => p.source === "chrome");
      expect(chromePage).toBeDefined();
      expect(chromePage!.sourceId).toBe("chrome");

      const bookmarksAfterFirst = await db.bookmarks.filter((b) => b.deletedAt === null).toArray();
      expect(bookmarksAfterFirst).toHaveLength(2);
      const bm1 = bookmarksAfterFirst.find((b) => b.sourceId === "chrome-bm-101")!;
      const bm2 = bookmarksAfterFirst.find((b) => b.sourceId === "chrome-bm-102")!;
      expect(bm1.title).toBe("GitHub Portal");
      expect(bm2.title).toBe("Mozilla MDN");

      const boardsAfterFirst = await db.boards.filter((b) => b.deletedAt === null && b.pageId === chromePage!.id).toArray();
      expect(boardsAfterFirst).toHaveLength(1);
      const devBoard = boardsAfterFirst[0]!;
      expect(devBoard.source).toBe("chrome");
      expect(devBoard.sourceId).toBe("chrome-fld-dev");

      // User customizes local data:
      // 1. Rename page locally
      await renamePage(chromePage!.id, "My Custom Chrome Bookmarks", db);
      // 2. Rename board locally
      await updateBoard(devBoard.id, { title: "Custom Dev Tools" }, db);
      // 3. Customize bookmark title and description
      await updateBookmark(bm1.id, { title: "My GitHub Enterprise", description: "Custom local notes" }, db);

      // Second identical Chrome refresh (without pageId, simulating Settings re-import/refresh)
      const secondSummary = await importRecords(
        chromeRecords,
        { pageTitle: "Chrome import", source: "chrome", sourceId: "chrome" },
        "skip",
        db,
      );

      expect(secondSummary.imported).toBe(0);
      expect(secondSummary.skippedDuplicates).toBe(2);

      // Invariant: EXACT SAME Page is reused, NO duplicate page created
      const pagesAfterSecond = await db.pages.filter((p) => p.deletedAt === null).toArray();
      expect(pagesAfterSecond).toHaveLength(2);
      const refreshedPage = pagesAfterSecond.find((p) => p.id === chromePage!.id)!;
      expect(refreshedPage).toBeDefined();
      expect(refreshedPage.title).toBe("My Custom Chrome Bookmarks"); // Local customization survives!

      // Invariant: EXACT SAME Board is reused, NO duplicate board created
      const boardsAfterSecond = await db.boards.filter((b) => b.deletedAt === null && b.pageId === chromePage!.id).toArray();
      expect(boardsAfterSecond).toHaveLength(1);
      expect(boardsAfterSecond[0]!.id).toBe(devBoard.id);
      expect(boardsAfterSecond[0]!.title).toBe("Custom Dev Tools"); // Local board title survives!

      // Invariant: Bookmark count unchanged, local edits survived
      const bookmarksAfterSecond = await db.bookmarks.filter((b) => b.deletedAt === null).toArray();
      expect(bookmarksAfterSecond).toHaveLength(2);
      const refreshedBm1 = bookmarksAfterSecond.find((b) => b.id === bm1.id)!;
      expect(refreshedBm1.title).toBe("My GitHub Enterprise");
      expect(refreshedBm1.description).toBe("Custom local notes");
      expect(refreshedBm1.sourceId).toBe("chrome-bm-101");

      db.close();
      await Dexie.delete(dbName);
    });
  });

  describe("AF-DATA-002: Chrome folder identity and same-name folder distinction", () => {
    it("distinguishes same-name folders under different parents and preserves identities", async () => {
      const dbName = `test-af-data-002-${crypto.randomUUID()}`;
      const db = new AsterfoldDatabase(dbName);
      await db.open();
      await ensureStarterWorkspace(db);

      const recordsWithSameFolderName: ImportRecord[] = [
        {
          title: "Work Doc",
          url: "https://work.example.com/doc",
          description: null,
          folderPath: ["Work", "Archive"],
          source: "chrome",
          sourceId: "bm-work-1",
          folderSourceId: "chrome-fld-work-archive",
        },
        {
          title: "Personal Photo",
          url: "https://photos.example.com/album",
          description: null,
          folderPath: ["Personal", "Archive"],
          source: "chrome",
          sourceId: "bm-pers-1",
          folderSourceId: "chrome-fld-pers-archive",
        },
        // Same URL under different folders
        {
          title: "Shared Reference in Work",
          url: "https://shared.example.com/ref",
          description: null,
          folderPath: ["Work", "Archive"],
          source: "chrome",
          sourceId: "bm-work-shared",
          folderSourceId: "chrome-fld-work-archive",
        },
        {
          title: "Shared Reference in Personal",
          url: "https://shared.example.com/ref",
          description: null,
          folderPath: ["Personal", "Archive"],
          source: "chrome",
          sourceId: "bm-pers-shared",
          folderSourceId: "chrome-fld-pers-archive",
        },
      ];

      const summary = await importRecords(
        recordsWithSameFolderName,
        { pageTitle: "Chrome import", source: "chrome", sourceId: "chrome" },
        "skip",
        db,
      );

      expect(summary.imported).toBe(4);

      const chromePage = (await db.pages.filter((p) => p.source === "chrome").toArray())[0]!;
      const boards = await db.boards.where("pageId").equals(chromePage.id).toArray();

      // INVARIANT: Two distinct boards created despite both being named "Archive"
      expect(boards).toHaveLength(2);
      const workBoard = boards.find((b) => b.sourceId === "chrome-fld-work-archive")!;
      const persBoard = boards.find((b) => b.sourceId === "chrome-fld-pers-archive")!;
      expect(workBoard).toBeDefined();
      expect(persBoard).toBeDefined();
      expect(workBoard.id).not.toBe(persBoard.id);
      expect(workBoard.title).toBe("Archive");
      expect(persBoard.title).toBe("Archive");

      // INVARIANT: Bookmarks with same URL in different folders are isolated in their respective boards
      const workBookmarks = await db.bookmarks.where("boardId").equals(workBoard.id).toArray();
      const persBookmarks = await db.bookmarks.where("boardId").equals(persBoard.id).toArray();
      expect(workBookmarks).toHaveLength(2);
      expect(persBookmarks).toHaveLength(2);

      const workShared = workBookmarks.find((b) => b.normalizedUrl === "https://shared.example.com/ref")!;
      const persShared = persBookmarks.find((b) => b.normalizedUrl === "https://shared.example.com/ref")!;
      expect(workShared.boardId).toBe(workBoard.id);
      expect(persShared.boardId).toBe(persBoard.id);
      expect(workShared.id).not.toBe(persShared.id);

      // Local rename of a board survives refresh
      await updateBoard(workBoard.id, { title: "Work Archive 2026" }, db);

      const refreshSummary = await importRecords(
        recordsWithSameFolderName,
        { pageTitle: "Chrome import", source: "chrome", sourceId: "chrome" },
        "skip",
        db,
      );
      expect(refreshSummary.imported).toBe(0);
      expect(refreshSummary.skippedDuplicates).toBe(4);

      const refreshedBoards = await db.boards.where("pageId").equals(chromePage.id).toArray();
      expect(refreshedBoards).toHaveLength(2);
      const refreshedWork = refreshedBoards.find((b) => b.sourceId === "chrome-fld-work-archive")!;
      expect(refreshedWork.title).toBe("Work Archive 2026");

      db.close();
      await Dexie.delete(dbName);
    });
  });

  describe("AF-ROB-001: Malformed HTML entity decoding without RangeError", () => {
    it("handles all Unicode boundaries and surrogate ranges safely as literals", () => {
      const htmlWithEntities = `
        <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
        <TITLE>Bookmarks</TITLE>
        <H1>Bookmarks</H1>
        <DL><p>
          <DT><H3>Valid Scalar &#65; &#x42; &#55295; &#57344; &#1114111;</H3>
          <DL><p>
            <DT><A HREF="https://example.com/scalar" ADD_DATE="1700000000">Scalar Title &#x10FFFF;</A>
            <DD>Scalar Desc &#0; &#xE000;</DD>
            <DT><A HREF="https://example.com/surrogates" ADD_DATE="1700000000">Surrogate Title &#55296; &#xD800; &#57343; &#xDFFF;</A>
            <DD>Surrogate Desc &#xD800; &#xDFFF;</DD>
            <DT><A HREF="https://example.com/overflow" ADD_DATE="1700000000">Overflow &#1114112; &#x110000; &#999999999999999999999999;</A>
            <DD>Overflow Desc &#xFFFFFFFFFFFFFF;</DD>
            <DT><A HREF="https://example.com/malformed?q=&#xZZZZ;&r=&#NaN;">Malformed Title &#NaN; &#xZZZZ;</A>
            <DD>Malformed Desc &#-1;</DD>
          </DL><p>
          <DT><H3>Surrogate Folder &#xD800; &#xDFFF;</H3>
          <DL><p>
            <DT><A HREF="https://example.com/in-surrogate-folder">Inside Surrogate Folder</A>
          </DL><p>
          <DT><H3>Overflow Folder &#x110000;</H3>
          <DL><p>
            <DT><A HREF="https://example.com/in-overflow-folder">Inside Overflow Folder</A>
          </DL><p>
        </DL><p>
      `;

      // Must never throw RangeError!
      let records: ImportRecord[] = [];
      expect(() => {
        records = parseNetscapeHtml(htmlWithEntities);
      }).not.toThrow();

      expect(records.length).toBeGreaterThan(0);

      // Verify scalar decoded correctly
      const scalarRec = records.find((r) => r.url === "https://example.com/scalar");
      expect(scalarRec).toBeDefined();
      expect(scalarRec!.title).toContain("\u{10FFFF}");
      expect(scalarRec!.folderPath[0]).toContain("A B");

      // Verify surrogates preserved safely without RangeError
      const surrogateRec = records.find((r) => r.url === "https://example.com/surrogates");
      expect(surrogateRec).toBeDefined();
      expect(surrogateRec!.title).toContain("&#xD800;");
      expect(surrogateRec!.description).toContain("&#xD800;");

      // Verify overflow preserved safely as literal
      const overflowRec = records.find((r) => r.url === "https://example.com/overflow");
      expect(overflowRec).toBeDefined();
      expect(overflowRec!.title).toContain("&#1114112;");
      expect(overflowRec!.description).toContain("&#xFFFFFFFFFFFFFF;");

      // Verify malformed folder names preserved safely
      const inSurrogateFolder = records.find((r) => r.url === "https://example.com/in-surrogate-folder");
      expect(inSurrogateFolder).toBeDefined();
      expect(inSurrogateFolder!.folderPath[0]).toContain("&#xD800;");

      const inOverflowFolder = records.find((r) => r.url === "https://example.com/in-overflow-folder");
      expect(inOverflowFolder).toBeDefined();
      expect(inOverflowFolder!.folderPath[0]).toContain("&#x110000;");
    });
  });

  describe("AF-MSG-001: Clean browser message protocol", () => {
    it("rejects removed message types and accepts canonical message schemas", () => {
      // Dead messages must be rejected by schema parser
      expect(parseExtensionMessage({ type: "QUICK_SAVE", tabId: 1 })).toBeNull();
      expect(parseExtensionMessage({ type: "INSTANT_SAVE", url: "https://example.com", title: "Bookmark" })).toBeNull();
      expect(parseExtensionMessage({ type: "SET_BADGE", status: "saved" })).toBeNull();

      // Canonical production messages
      expect(parseExtensionMessage({ type: "OPEN_WORKSPACE", pageId: "page-123" })).toEqual({
        type: "OPEN_WORKSPACE",
        pageId: "page-123",
      });
      expect(parseExtensionMessage({ type: "OPEN_URL", url: "https://example.com", mode: "incognito" })).toEqual({
        type: "OPEN_URL",
        url: "https://example.com",
        mode: "incognito",
      });
      expect(parseExtensionMessage({ type: "DATA_CHANGED", entity: "bookmark" })).toEqual({
        type: "DATA_CHANGED",
        entity: "bookmark",
      });
    });
  });
});
