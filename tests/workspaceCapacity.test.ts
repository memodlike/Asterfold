import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import type { Board, Bookmark, Page } from "../src/domain/models";
import { evenlySpacedRanks } from "../src/domain/ordering";
import {
  bulkRestoreBookmarks, createBoard, createBookmark, createBookmarksBulk, createPage,
  duplicateBoard, duplicateBookmark, duplicatePage, ensureStarterWorkspace,
  restoreBoard, restoreBookmark, restorePage, softDeleteBoard, softDeleteBookmark, softDeletePage,
} from "../src/db/repository";
import { createBackup, importRecords, restoreBackup } from "../src/services/exportImport";

// Exercise the actual transaction and schema boundaries with small workspace quotas.
vi.mock("../src/domain/importLimits", () => ({
  IMPORT_LIMITS: { fileBytes: 128 * 1024 * 1024, depth: 100, nodes: 250_000, pages: 4, boards: 5, bookmarks: 6 },
}));

describe("backup-compatible workspace capacity", () => {
  let database: AsterfoldDatabase;
  let page: Page;
  let board: Board;
  let bookmark: Bookmark;
  beforeEach(async () => {
    database = new AsterfoldDatabase(`capacity-${crypto.randomUUID()}`);
    const initial = await ensureStarterWorkspace(database);
    page = initial.pages[0]!;
    board = initial.boards[0]!;
    bookmark = await createBookmark({ boardId: board.id, title: "Saved", url: "https://example.com/saved" }, {}, database);
  });
  afterEach(async () => { await database.delete(); });

  async function fill(kind: "pages" | "boards" | "bookmarks", total: number, trash = false) {
    const positions = evenlySpacedRanks(total);
    const deleted = trash ? { deletedAt: "2020-01-01T00:00:00.000Z", deletedBatchId: "old" } : {};
    if (kind === "pages") {
      await database.pages.bulkPut(Array.from({ length: total }, (_, i) => ({ ...page, ...(i ? deleted : {}), id: i ? `page-${i}` : page.id, isDefault: i === 0, position: positions[i]! })));
    } else if (kind === "boards") {
      await database.boards.bulkPut(Array.from({ length: total }, (_, i) => ({ ...board, ...(i ? deleted : {}), id: i ? `board-${i}` : board.id, position: positions[i]! })));
    } else {
      await database.bookmarks.bulkPut(Array.from({ length: total }, (_, i) => ({ ...bookmark, ...(i ? deleted : {}), id: i ? `bookmark-${i}` : bookmark.id, url: `https://example.com/${i}`, normalizedUrl: `https://example.com/${i}`, position: positions[i]! })));
    }
  }
  const state = () => Promise.all([database.pages.toArray(), database.boards.toArray(), database.bookmarks.toArray(), database.settings.toArray()]);
  const record = (url = "https://new.example/") => ({ title: "New", url, description: null, folderPath: [board.title] });

  it.each(["single", "paste", "duplicate"])("rejects %s bookmark insertion at capacity including Trash", async (kind) => {
    await fill("bookmarks", 6, true);
    const before = await state();
    const action = kind === "single" ? () => createBookmark({ boardId: board.id, title: "New", url: "https://new.example" }, {}, database)
      : kind === "paste" ? () => createBookmarksBulk(board.id, [{ url: "https://new.example" }], database)
        : () => duplicateBookmark(bookmark.id, database);
    await expect(action()).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
    expect((await createBackup({}, database)).entities.bookmarks).toHaveLength(6);
  });

  it.each(["create page", "duplicate page", "create board", "duplicate board", "replacement page"])("bounds %s atomically", async (kind) => {
    await fill("pages", 4, true);
    await fill("boards", 5, true);
    const before = await state();
    const action = kind === "create page" ? () => createPage("New", {}, database)
      : kind === "duplicate page" ? () => duplicatePage(page.id, database)
        : kind === "create board" ? () => createBoard(page.id, "New", database)
          : kind === "duplicate board" ? () => duplicateBoard(board.id, database)
            : () => softDeletePage(page.id, database);
    await expect(action()).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it("rolls back replacement creation when boards are full even if page space remains", async () => {
    await fill("boards", 5, true);
    const before = await state();
    await expect(softDeletePage(page.id, database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it.each(["pages", "boards"] as const)("bounds starter creation against existing trashed %s", async (kind) => {
    await fill(kind, kind === "pages" ? 4 : 5, true);
    await database.pages.toCollection().modify({ deletedAt: "2020-01-01T00:00:00.000Z", isDefault: false });
    await database.boards.toCollection().modify({ deletedAt: "2020-01-01T00:00:00.000Z" });
    await database.bookmarks.toCollection().modify({ deletedAt: "2020-01-01T00:00:00.000Z" });
    const before = await state();
    await expect(ensureStarterWorkspace(database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it("rolls back a pasted batch that needs more than the remaining capacity", async () => {
    await fill("bookmarks", 5);
    const before = await state();
    await expect(createBookmarksBulk(board.id, [{ url: "https://one.example" }, { url: "https://two.example" }], database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it.each(["page", "board"])("rolls back %s duplication when descendant bookmarks exceed capacity", async (kind) => {
    await fill("bookmarks", 4);
    const before = await state();
    await expect(kind === "page" ? duplicatePage(page.id, database) : duplicateBoard(board.id, database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it("rolls back page duplication when descendant boards exceed capacity", async () => {
    await fill("boards", 3);
    const before = await state();
    await expect(duplicatePage(page.id, database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it.each(["pages", "boards", "bookmarks"] as const)("rejects projected import %s overflow with no partial writes", async (kind) => {
    await fill(kind, kind === "pages" ? 4 : kind === "boards" ? 5 : 6, true);
    const before = await state();
    await expect(importRecords([{ ...record(), folderPath: kind === "boards" ? ["New folder"] : [board.title] }], kind === "pages" ? { pageTitle: "New" } : { pageTitle: page.title, pageId: page.id }, "allow", database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it("checks import totals after deduplication and allows the last available slot", async () => {
    await fill("bookmarks", 5);
    const saved = (await database.bookmarks.get(bookmark.id))!;
    const result = await importRecords([record(saved.url), record()], { pageTitle: page.title, pageId: page.id }, "skip", database);
    expect(result).toMatchObject({ imported: 1, skippedDuplicates: 1 });
    expect((await createBackup({}, database)).entities.bookmarks).toHaveLength(6);
    expect(await createBookmarksBulk(board.id, [{ url: saved.url }], database)).toEqual([]);
    expect(await importRecords([record(saved.url)], { pageTitle: page.title, pageId: page.id }, "skip", database)).toMatchObject({ imported: 0, skippedDuplicates: 1 });
  });

  it("rolls back all import groups when a later group exceeds the total", async () => {
    await fill("bookmarks", 5);
    const before = await state();
    await expect(importRecords([record(), { ...record("https://other.example"), folderPath: ["Other"] }], { pageTitle: page.title, pageId: page.id }, "allow", database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
  });

  it("serializes concurrent insertions competing for the last bookmark slot", async () => {
    await fill("bookmarks", 5);
    const results = await Promise.allSettled([
      createBookmark({ boardId: board.id, title: "One", url: "https://one.example" }, {}, database),
      importRecords([record()], { pageTitle: page.title, pageId: page.id }, "allow", database),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await createBackup({}, database)).entities.bookmarks).toHaveLength(6);
  });

  it.each(["pages", "boards", "bookmarks"] as const)("rejects backup merge beyond %s capacity and permits replacement", async (kind) => {
    const incoming = await createBackup({}, database);
    await fill(kind, kind === "pages" ? 4 : kind === "boards" ? 5 : 6, true);
    const before = await state();
    await expect(restoreBackup(incoming, "merge", database)).rejects.toMatchObject({ code: "WORKSPACE_LIMIT" });
    expect(await state()).toEqual(before);
    await restoreBackup(incoming, "replace", database);
    expect((await createBackup({}, database)).entities).toEqual(incoming.entities);
  });

  it.each(["page", "board", "bookmark", "bulk bookmarks"])("restores %s at total capacity without counting Trash twice", async (kind) => {
    if (kind === "page") {
      await softDeletePage(page.id, database);
      const current = await database.pages.toArray();
      await database.pages.bulkAdd(Array.from({ length: 4 - current.length }, (_, i) => ({ ...page, id: `extra-${i}`, isDefault: false, deletedAt: "2020-01-01T00:00:00.000Z" })));
    } else {
      await fill("boards", 5);
      await fill("bookmarks", 6);
      if (kind === "board") await softDeleteBoard(board.id, database);
      else await softDeleteBookmark(bookmark.id, database);
    }
    if (kind === "page") await restorePage(page.id, database);
    else if (kind === "board") await restoreBoard(board.id, database);
    else if (kind === "bookmark") await restoreBookmark(bookmark.id, database);
    else await bulkRestoreBookmarks([bookmark.id], database);
    expect((await database.pages.get(page.id))?.deletedAt).toBeNull();
    expect((await database.boards.get(board.id))?.deletedAt).toBeNull();
    expect((await database.bookmarks.get(bookmark.id))?.deletedAt).toBeNull();
    await expect(createBackup({}, database)).resolves.toBeDefined();
  });
});
