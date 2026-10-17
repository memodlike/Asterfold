import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import {
  createBoard, createBookmark, ensureStarterWorkspace, getWorkspaceData, renamePage,
  restoreBoard, restorePage, setDefaultPage, softDeleteBoard, softDeletePage,
  updateBoard, updateBookmark, updateSettings,
} from "../src/db/repository";
import { createBackup, parseBackup, serializeBackup, toMarkdown, toNetscapeHtml } from "../src/services/exportImport";

describe("workspace data integrity regressions", () => {
  let database: AsterfoldDatabase;
  beforeEach(async () => {
    database = new AsterfoldDatabase(`integrity-${crypto.randomUUID()}`);
    await database.open();
  });
  afterEach(async () => { await database.delete(); });

  it("exports the replacement workspace and Trash after deleting the sole page", async () => {
    const initial = await ensureStarterWorkspace(database);
    await softDeletePage(initial.pages[0]!.id, database);
    const backup = parseBackup(serializeBackup(await createBackup({}, database)));
    expect(backup.entities.pages).toHaveLength(2);
    expect(backup.entities.pages.filter((page) => page.deletedAt !== null)).toHaveLength(1);
    expect(toNetscapeHtml(backup)).toContain("Workspace");
    expect(toMarkdown(backup)).toContain("Workspace");
  });

  it("allows Trash rank collisions but rejects active sibling rank collisions", async () => {
    const initial = await ensureStarterWorkspace(database);
    const board = initial.boards[0]!;
    const bookmark = await createBookmark({ boardId: board.id, title: "First", url: "https://example.com/1" }, {}, database);
    const backup = await createBackup({}, database);
    const deleted = { deletedAt: "2026-01-01T00:00:00.000Z", deletedBatchId: "trash" };
    backup.entities.boards.push({ ...board, id: "trashed-board", ...deleted });
    backup.entities.bookmarks.push({ ...bookmark, id: "trashed-bookmark", ...deleted });
    expect(() => parseBackup(serializeBackup(backup))).not.toThrow();
    backup.entities.boards[1]!.deletedAt = null;
    expect(() => parseBackup(serializeBackup(backup))).toThrow(/Duplicate rank in boards/);
    backup.entities.boards[1]!.deletedAt = deleted.deletedAt;
    backup.entities.bookmarks[1]!.deletedAt = null;
    expect(() => parseBackup(serializeBackup(backup))).toThrow(/Duplicate rank in bookmarks/);
    backup.entities.bookmarks[1]!.deletedAt = deleted.deletedAt;
    backup.entities.pages.push({ ...initial.pages[0]!, id: "other-page", isDefault: false });
    expect(() => parseBackup(serializeBackup(backup))).toThrow(/Duplicate rank in pages/);
  });

  it("serializes concurrent board patches across database connections", async () => {
    const initial = await ensureStarterWorkspace(database);
    const other = new AsterfoldDatabase(database.name);
    await other.open();
    try {
      const board = initial.boards[0]!;
      await Promise.all([
        updateBoard(board.id, { title: "Renamed" }, database),
        updateBoard(board.id, { gridSpan: 6 }, other),
      ]);
      expect(await database.boards.get(board.id)).toMatchObject({ title: "Renamed", gridSpan: 6, version: board.version + 2 });
    } finally { other.close(); }
  });

  it("increments page versions for every concurrent rename", async () => {
    const initial = await ensureStarterWorkspace(database);
    const page = initial.pages[0]!;
    await Promise.all([renamePage(page.id, "First", database), renamePage(page.id, "Second", database)]);
    expect(await database.pages.get(page.id)).toMatchObject({ title: "Second", version: page.version + 2 });
    await Promise.all([renamePage(page.id, "Final", database), setDefaultPage(page.id, database)]);
    expect(await database.pages.get(page.id)).toMatchObject({ title: "Final", isDefault: true });
  });

  it("retains concurrent bookmark and settings patches", async () => {
    const initial = await ensureStarterWorkspace(database);
    const bookmark = await createBookmark({ boardId: initial.boards[0]!.id, title: "Old", url: "https://example.com" }, {}, database);
    await Promise.all([
      updateBookmark(bookmark.id, { title: "Renamed" }, database),
      updateBookmark(bookmark.id, { description: "New note" }, database),
      updateSettings({ workspaceRows: 1 }, database),
      updateSettings({ workspaceAlignment: "right" }, database),
    ]);
    expect(await database.bookmarks.get(bookmark.id)).toMatchObject({ title: "Renamed", description: "New note", version: bookmark.version + 2 });
    expect(await database.settings.get("app")).toMatchObject({ workspaceRows: 1, workspaceAlignment: "right" });
  });

  it.each(["page", "board"] as const)("preserves child rank order when restoring a %s", async (kind) => {
    const initial = await ensureStarterWorkspace(database);
    const page = initial.pages[0]!;
    await database.boards.delete(initial.boards[0]!.id);
    const firstBoard = await createBoard(page.id, "First", database);
    const secondBoard = await createBoard(page.id, "Second", database);
    // Index iteration is by primary key, deliberately opposite to saved rank order.
    await database.boards.delete(firstBoard.id);
    await database.boards.delete(secondBoard.id);
    await database.boards.bulkAdd([{ ...firstBoard, id: "z" }, { ...secondBoard, id: "a" }]);
    for (const boardId of ["z", "a"]) {
      const first = await createBookmark({ boardId, title: "First link", url: "https://example.com/1" }, {}, database);
      const second = await createBookmark({ boardId, title: "Second link", url: "https://example.com/2" }, {}, database);
      await database.bookmarks.bulkDelete([first.id, second.id]);
      await database.bookmarks.bulkAdd([{ ...first, id: `${boardId}-z` }, { ...second, id: `${boardId}-a` }]);
    }
    if (kind === "page") {
      await softDeletePage(page.id, database);
      await restorePage(page.id, database);
    } else {
      await softDeleteBoard("z", database);
      await restoreBoard("z", database);
    }
    const restored = await getWorkspaceData(database);
    if (kind === "page") expect(restored.boards.filter((b) => b.pageId === page.id).map((b) => b.title)).toEqual(["First", "Second"]);
    for (const boardId of ["z", "a"]) {
      expect(restored.bookmarks.filter((b) => b.boardId === boardId).map((b) => b.title)).toEqual(["First link", "Second link"]);
    }
  });
});
