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
  bulkMoveBookmarks,
  emptyTrash,
  permanentlyDelete,
  moveBookmarkToIndex,
  purgeTrash,
  restoreBoard,
  restorePage,
  softDeleteBoard,
  softDeleteBookmark,
  softDeletePage,
  updateBoard,
  updateBookmark,
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
    expect(first.openMode).toBe("current");
    await expect(createBookmark({ boardId: board.id, title: "Again", url: "https://dexie.org/" }, {}, database)).rejects.toBeInstanceOf(DuplicateError);
    await expect(updateBookmark(second.id, { url: "https://dexie.org/" }, database)).rejects.toBeInstanceOf(DuplicateError);

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

  it("moves a deduplicated bookmark selection in one transaction and rolls back on failure", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const source = workspace.boards[0]!;
    const target = await createBoard(workspace.pages[0]!.id, "Target", database);
    const first = await createBookmark({ boardId: source.id, title: "First", url: "https://first.example" }, {}, database);
    const second = await createBookmark({ boardId: source.id, title: "Second", url: "https://second.example" }, {}, database);
    const third = await createBookmark({ boardId: source.id, title: "Third", url: "https://third.example" }, {}, database);

    await bulkMoveBookmarks([third.id, first.id, third.id], target.id, database);
    expect((await database.bookmarks.where("boardId").equals(target.id).sortBy("position")).map((item) => item.id)).toEqual([first.id, third.id]);

    const before = await database.bookmarks.toArray();
    await expect(bulkMoveBookmarks([second.id, "missing"], target.id, database)).rejects.toThrow();
    expect(await database.bookmarks.toArray()).toEqual(before);
  });

  it("serializes concurrent appends without duplicate positions", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const board = workspace.boards[0]!;
    await Promise.all(Array.from({ length: 40 }, (_, index) => createBookmark({
      boardId: board.id,
      title: `Concurrent ${index}`,
      url: `https://concurrent.example/${index}`,
    }, {}, database)));
    const bookmarks = await database.bookmarks.where("boardId").equals(board.id).toArray();
    expect(bookmarks).toHaveLength(40);
    expect(new Set(bookmarks.map((bookmark) => bookmark.position)).size).toBe(40);
  });

  it("repairs default, active, and Quick Save references after deleting destinations", async () => {
    const initial = await ensureStarterWorkspace(database);
    const originalPage = initial.pages[0]!;
    const originalBoard = initial.boards[0]!;
    const replacementPage = await createPage("Replacement", {}, database);
    const replacementBoard = await createBoard(replacementPage.id, "Replacement board", database);
    await updateSettings({
      activePageId: originalPage.id,
      quickSaveDefaultPageId: originalPage.id,
      quickSaveDefaultBoardId: originalBoard.id,
      quickSaveLastPageId: originalPage.id,
      quickSaveLastBoardId: originalBoard.id,
    }, database);

    await softDeletePage(originalPage.id, database);
    const settings = await database.settings.get("app");
    expect(settings).toMatchObject({
      activePageId: replacementPage.id,
      quickSaveDefaultPageId: replacementPage.id,
      quickSaveDefaultBoardId: replacementBoard.id,
      quickSaveLastPageId: replacementPage.id,
      quickSaveLastBoardId: replacementBoard.id,
    });
    const defaults = (await database.pages.toArray()).filter((page) => page.deletedAt === null && page.isDefault);
    expect(defaults.map((page) => page.id)).toEqual([replacementPage.id]);
    expect(await auditInvariants(database)).toEqual([]);
  });

  it("purges a deleted hierarchy from its root and tolerates repeated destructive submissions", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const page = workspace.pages[0]!;
    const board = workspace.boards[0]!;
    const bookmark = await createBookmark({ boardId: board.id, title: "Child", url: "https://child.example" }, {}, database);
    await softDeletePage(page.id, database);
    await database.pages.update(page.id, { deletedAt: "2020-01-01T00:00:00.000Z" });
    await database.boards.update(board.id, { deletedAt: "2030-01-01T00:00:00.000Z" });
    await database.bookmarks.update(bookmark.id, { deletedAt: "2030-01-01T00:00:00.000Z" });

    expect(await purgeTrash(30, database)).toBe(3);
    expect(await database.pages.get(page.id)).toBeUndefined();
    expect(await database.boards.get(board.id)).toBeUndefined();
    expect(await database.bookmarks.get(bookmark.id)).toBeUndefined();

    const replacement = (await getWorkspaceData(database)).pages[0]!;
    await softDeletePage(replacement.id, database);
    await permanentlyDelete("page", replacement.id, database);
    await expect(permanentlyDelete("page", replacement.id, database)).resolves.toBeUndefined();
    expect(await emptyTrash(database)).toBeGreaterThanOrEqual(0);
    expect(await emptyTrash(database)).toBe(0);
  });

  it("garbage-collects uploaded wallpapers after replacing the active reference", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const timestamp = new Date().toISOString();
    await database.wallpapers.bulkAdd(["old", "current"].map((id) => ({
      id, kind: "upload" as const, name: id, mimeType: "image/webp", blob: new Blob(["x"]),
      thumbnail: null, value: null, createdAt: timestamp, updatedAt: timestamp,
    })));
    await updateSettings({ theme: { ...workspace.settings.theme, wallpaperId: "current", backgroundMode: "wallpaper" } }, database);
    expect((await database.wallpapers.toArray()).map((wallpaper) => wallpaper.id)).toEqual(["current"]);
  });
});
