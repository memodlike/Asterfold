import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import {
  auditInvariants,
  createBoard,
  createBookmark,
  createPage,
  ensureStarterWorkspace,
  getWorkspaceData,
  listTrash,
  moveBookmarkToIndex,
  purgeTrash,
  restoreBoard,
  restorePage,
  softDeleteBoard,
  softDeleteBookmark,
  softDeletePage,
  updateBoard,
  updateSettings,
} from "../src/db/repository";
import { DuplicateError } from "../src/domain/errors";

describe("Dexie workspace repository", () => {
  let database: AsterfoldDatabase;

  beforeEach(async () => {
    database = new AsterfoldDatabase(`asterfold-test-${crypto.randomUUID()}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it("seeds a usable local workspace and performs hierarchy CRUD", async () => {
    const initial = await ensureStarterWorkspace(database);
    expect(initial.pages).toHaveLength(1);
    expect(initial.boards).toHaveLength(1);

    const page = await createPage("Research", {}, database);
    const board = await createBoard(page.id, "Reading", database);
    const first = await createBookmark({ boardId: board.id, title: "Dexie", url: "https://dexie.org/?utm_source=test" }, {}, database);
    const second = await createBookmark({ boardId: board.id, title: "WXT", url: "https://wxt.dev/" }, {}, database);
    expect(first.normalizedUrl).toBe("https://dexie.org/");
    await expect(createBookmark({ boardId: board.id, title: "Again", url: "https://dexie.org/" }, {}, database)).rejects.toBeInstanceOf(DuplicateError);

    await moveBookmarkToIndex(second.id, board.id, 0, database);
    const workspace = await getWorkspaceData(database);
    expect(workspace.bookmarks.filter((item) => item.boardId === board.id).map((item) => item.id)).toEqual([second.id, first.id]);
    expect(await auditInvariants(database)).toEqual([]);
  });

  it("cascades soft deletion and restores the exact batch", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const page = workspace.pages[0]!;
    const board = workspace.boards[0]!;
    const bookmark = await createBookmark({ boardId: board.id, title: "Example", url: "https://example.com" }, {}, database);

    await softDeleteBoard(board.id, database);
    let trash = await listTrash(database);
    expect(trash.boards.map((item) => item.id)).toContain(board.id);
    expect(trash.bookmarks.map((item) => item.id)).toContain(bookmark.id);
    await restoreBoard(board.id, database);
    expect((await database.bookmarks.get(bookmark.id))?.deletedAt).toBeNull();

    await softDeletePage(page.id, database);
    trash = await listTrash(database);
    expect(trash.pages.map((item) => item.id)).toContain(page.id);
    expect((await getWorkspaceData(database)).pages.length).toBeGreaterThanOrEqual(1);
    await restorePage(page.id, database);
    expect((await database.pages.get(page.id))?.deletedAt).toBeNull();
    expect(await auditInvariants(database)).toEqual([]);
  });

  it("purges only Trash records older than the configured retention", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const bookmark = await createBookmark({ boardId: workspace.boards[0]!.id, title: "Old", url: "https://old.example" }, {}, database);
    await softDeleteBookmark(bookmark.id, database);
    await database.bookmarks.update(bookmark.id, { deletedAt: "2020-01-01T00:00:00.000Z" });
    expect(await purgeTrash(30, database)).toBe(1);
    expect(await database.bookmarks.get(bookmark.id)).toBeUndefined();
  });

  it("persists free-grid coordinates, board width, columns, and workspace layout", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const board = workspace.boards[0]!;
    await updateBoard(board.id, { gridColumn: 7, gridRow: 1, gridSpan: 6, bookmarkColumns: 2 }, database);
    await updateSettings({ workspaceLayoutMode: "free", workspaceRows: 1, workspaceAlignment: "right" }, database);
    database.close();
    await database.open();
    expect(await database.boards.get(board.id)).toMatchObject({ gridColumn: 7, gridRow: 1, gridSpan: 6, bookmarkColumns: 2 });
    expect(await database.settings.get("app")).toMatchObject({ workspaceLayoutMode: "free", workspaceRows: 1, workspaceAlignment: "right" });
  });
});
