import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { createDefaultSettings } from "../src/db/defaults";
import type { Board, Bookmark, Page, Snapshot, Wallpaper } from "../src/domain/models";
import {
  auditInvariants,
  bulkDeleteBookmarks,
  bulkMoveBookmarks,
  bulkRestoreBookmarks,
  createBoard,
  createBookmark,
  createPage,
  duplicateBoard,
  duplicateBookmark,
  duplicatePage,
  emptyTrash,
  ensureStarterWorkspace,
  findDuplicate,
  garbageCollectWallpapers,
  getWallpaper,
  getWorkspaceData,
  moveBoardToIndex,
  moveBoardWithGridSwap,
  moveBookmarkToIndex,
  movePageToIndex,
  permanentlyDelete,
  purgeTrash,
  renamePage,
  restoreBoard,
  restoreBookmark,
  restorePage,
  setDefaultPage,
  softDeleteBoard,
  softDeleteBookmark,
  softDeletePage,
  updateBoard,
  updateBookmark,
  updateSettings,
} from "../src/db/repository";

const timestamp = "2026-01-01T00:00:00.000Z";

function pageRecord(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    userId: null,
    title: id,
    icon: null,
    accent: null,
    position: `a${id}`,
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
    ...overrides,
  };
}

function boardRecord(id: string, pageId: string, overrides: Partial<Board> = {}): Board {
  return {
    id,
    userId: null,
    pageId,
    title: id,
    icon: null,
    accent: null,
    position: `b${id}`,
    collapsed: false,
    layout: "list",
    bookmarkColumns: "auto",
    gridColumn: 1,
    gridRow: 0,
    gridSpan: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
    ...overrides,
  };
}

function bookmarkRecord(id: string, boardId: string, overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    userId: null,
    boardId,
    title: id,
    url: `https://${id}.example/`,
    normalizedUrl: `https://${id}.example/`,
    hostname: `${id}.example`,
    description: null,
    faviconUrl: null,
    customIcon: null,
    position: `c${id}`,
    openMode: "current",
    pinned: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
    ...overrides,
  };
}

describe("repository branch coverage", () => {
  let database: AsterfoldDatabase;

  beforeEach(async () => {
    database = new AsterfoldDatabase(`asterfold-branch-${crypto.randomUUID()}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it("repairs invalid defaults and Quick Save pairs while leaving a repaired workspace stable", async () => {
    const initial = await ensureStarterWorkspace(database);
    const firstPage = initial.pages[0]!;
    const firstBoard = initial.boards[0]!;
    const secondPage = await createPage("Second", {}, database);
    const secondBoard = await createBoard(secondPage.id, "Second board", database);

    await database.pages.update(firstPage.id, { isDefault: false });
    await database.pages.update(secondPage.id, { isDefault: false });
    await database.settings.update("app", {
      activePageId: "missing-page",
      quickSaveDefaultPageId: secondPage.id,
      quickSaveDefaultBoardId: firstBoard.id,
      quickSaveLastPageId: "missing-page",
      quickSaveLastBoardId: "missing-board",
    });

    const repaired = await ensureStarterWorkspace(database);
    expect(repaired.pages.filter((item) => item.isDefault)).toHaveLength(1);
    expect(repaired.settings.activePageId).toBe(firstPage.id);
    expect(repaired.settings.quickSaveDefaultPageId).toBe(secondPage.id);
    expect(repaired.settings.quickSaveDefaultBoardId).toBe(secondBoard.id);
    expect(repaired.settings.quickSaveLastPageId).toBe(firstPage.id);
    expect(repaired.settings.quickSaveLastBoardId).toBe(firstBoard.id);

    const stable = await ensureStarterWorkspace(database);
    expect(stable.settings).toMatchObject(repaired.settings);
  });

  it("handles missing settings, disabled retention, and an empty database audit", async () => {
    await expect(getWorkspaceData(database, false)).rejects.toThrow("Application settings are unavailable");
    expect(await auditInvariants(database)).toEqual(expect.arrayContaining([
      "No active Page exists",
      "Exactly one active default Page is required",
      "App settings are missing",
    ]));
    const settings = createDefaultSettings();
    await database.settings.add(settings);
    await expect(getWorkspaceData(database, false)).resolves.toEqual({ pages: [], boards: [], bookmarks: [], settings });
    await expect(purgeTrash(null, database)).resolves.toBe(0);
    expect(await auditInvariants(database)).toEqual(expect.arrayContaining([
      "No active Page exists",
      "Exactly one active default Page is required",
      "Quick Save default Page points to a missing Page",
      "Quick Save last Page points to a missing Page",
    ]));
  });

  it("covers Page options, no-op moves, hierarchy duplication, and validation failures", async () => {
    const initial = await ensureStarterWorkspace(database);
    const originalPage = initial.pages[0]!;
    const originalBoard = initial.boards[0]!;
    await createBookmark({ boardId: originalBoard.id, title: "Source", url: "https://source.example/" }, {}, database);

    const configured = await createPage("   ", { icon: "star", accent: "#abcdef", setDefault: true }, database);
    expect(configured).toMatchObject({ title: "Untitled page", icon: "star", accent: "#abcdef", isDefault: true });
    expect(await database.pages.get(originalPage.id)).toMatchObject({ isDefault: false });

    await renamePage(configured.id, "   ", database);
    expect(await database.pages.get(configured.id)).toMatchObject({ title: "Untitled page" });
    await expect(renamePage("missing", "Name", database)).rejects.toThrow("Page not found");

    await movePageToIndex(configured.id, 1, database);
    await expect(movePageToIndex("missing", 0, database)).rejects.toThrow("Page not found");

    await setDefaultPage(configured.id, database);
    expect(await database.settings.get("app")).toMatchObject({ quickSaveDefaultPageId: configured.id, quickSaveDefaultBoardId: null });
    await expect(setDefaultPage("missing", database)).rejects.toThrow("Page not found");

    const emptyCopy = await duplicatePage(configured.id, database);
    expect((await database.boards.where("pageId").equals(emptyCopy.id).count())).toBe(0);
    const fullCopy = await duplicatePage(originalPage.id, database);
    const copiedBoards = await database.boards.where("pageId").equals(fullCopy.id).toArray();
    expect(copiedBoards).toHaveLength(1);
    expect(await database.bookmarks.where("boardId").equals(copiedBoards[0]!.id).count()).toBe(1);
    await expect(duplicatePage("missing", database)).rejects.toThrow("Page not found");

    const detached = await createPage("Detached", {}, database);
    await softDeletePage(detached.id, database);
    await database.pages.update(detached.id, { deletedBatchId: null });
    await restorePage(detached.id, database);
    expect(await database.pages.get(detached.id)).toMatchObject({ deletedAt: null, deletedBatchId: null });

    await database.pages.update(configured.id, { deletedAt: timestamp });
    await expect(renamePage(configured.id, "Name", database)).rejects.toThrow("Page not found");
  });

  it("covers Board normalization, moves, swaps, duplication, and deleted-parent restore conflicts", async () => {
    const initial = await ensureStarterWorkspace(database);
    const page = initial.pages[0]!;
    const first = initial.boards[0]!;
    const second = await createBoard(page.id, "   ", database);
    const third = await createBoard(page.id, "Third", database);
    expect(second.title).toBe("Untitled board");

    await updateBoard(second.id, {}, database);
    const extremePatch: Parameters<typeof updateBoard>[1] = { title: "   ", gridColumn: -5, gridSpan: 99 };
    Reflect.set(extremePatch, "gridRow", 7);
    await updateBoard(second.id, extremePatch, database);
    expect(await database.boards.get(second.id)).toMatchObject({ title: "Untitled board", gridColumn: 1, gridRow: 0, gridSpan: 6 });
    await expect(updateBoard("missing", {}, database)).rejects.toThrow("Board not found");

    await moveBoardWithGridSwap(first.id, first.id, page.id, 0, database);
    const thirdBefore = await database.boards.get(third.id);
    await updateBoard(first.id, { gridColumn: 2, gridRow: 0, gridSpan: 3 }, database);
    await updateBoard(second.id, { gridColumn: 8, gridRow: 1, gridSpan: 5 }, database);
    await moveBoardWithGridSwap(first.id, second.id, page.id, 1, database);
    expect(await database.boards.get(first.id)).toMatchObject({ gridColumn: 8, gridRow: 1, gridSpan: 5 });
    expect(await database.boards.get(third.id)).toMatchObject({ version: (thirdBefore?.version ?? 0) + 1 });
    await expect(moveBoardWithGridSwap(first.id, "missing", page.id, 0, database)).rejects.toThrow();

    await moveBoardToIndex(first.id, page.id, 0, database);
    const otherPage = await createPage("Other", {}, database);
    await moveBoardToIndex(first.id, otherPage.id, 0, database);
    expect(await database.boards.get(first.id)).toMatchObject({ pageId: otherPage.id });
    await expect(moveBoardToIndex("missing", page.id, 0, database)).rejects.toThrow();

    const emptyCopy = await duplicateBoard(third.id, database);
    expect(await database.bookmarks.where("boardId").equals(emptyCopy.id).count()).toBe(0);
    await createBookmark({ boardId: second.id, title: "Child", url: "https://child-board.example/" }, {}, database);
    const fullCopy = await duplicateBoard(second.id, database);
    expect(await database.bookmarks.where("boardId").equals(fullCopy.id).count()).toBe(1);
    await expect(duplicateBoard("missing", database)).rejects.toThrow("Board not found");

    await softDeleteBoard(second.id, database);
    await database.pages.update(page.id, { deletedAt: timestamp });
    await expect(restoreBoard(second.id, database)).rejects.toThrow("Restore the parent page first");
    await database.pages.update(page.id, { deletedAt: null });
    await restoreBoard(second.id, database);
    await expect(restoreBoard(second.id, database)).rejects.toThrow("Deleted board not found");
  });

  it("covers Bookmark defaults, duplicate overrides, partial updates, moves, and restore conflicts", async () => {
    const initial = await ensureStarterWorkspace(database);
    const source = initial.boards[0]!;
    const target = await createBoard(initial.pages[0]!.id, "Target", database);

    const first = await createBookmark({ boardId: source.id, title: "   ", url: "https://example.com/path", description: "   " }, {}, database);
    expect(first).toMatchObject({ title: "example.com", description: null, openMode: "current", pinned: false });
    const duplicate = await createBookmark({ boardId: source.id, title: "Allowed", url: first.url, openMode: "new-tab", pinned: true }, { allowDuplicate: true }, database);
    expect(duplicate).toMatchObject({ openMode: "new-tab", pinned: true });
    expect(await findDuplicate(source.id, first.url, database, first.id)).toMatchObject({ id: duplicate.id });
    await expect(createBookmark({ boardId: "missing", title: "Bad", url: "https://bad.example/" }, {}, database)).rejects.toThrow("Board not found");

    const unchanged = await updateBookmark(first.id, {}, database);
    expect(unchanged).toMatchObject({ boardId: source.id, url: first.url, title: first.title });
    const moved = await updateBookmark(first.id, { boardId: target.id, title: "   ", description: "  note  " }, database);
    expect(moved).toMatchObject({ boardId: target.id, title: first.title, description: "note" });
    await expect(updateBookmark("missing", {}, database)).rejects.toThrow("Bookmark not found");

    await moveBookmarkToIndex(first.id, target.id, 0, database);
    await moveBookmarkToIndex(first.id, source.id, 0, database);
    await expect(moveBookmarkToIndex("missing", source.id, 0, database)).rejects.toThrow();

    const copy = await duplicateBookmark(first.id, database);
    expect(copy.title).toContain("copy");
    await expect(duplicateBookmark("missing", database)).rejects.toThrow("Bookmark not found");

    await bulkMoveBookmarks([], target.id, database);
    await bulkRestoreBookmarks([], database);
    await bulkDeleteBookmarks([], database);
    await expect(bulkMoveBookmarks([first.id], "missing", database)).rejects.toThrow("Target board not found");
    await expect(bulkRestoreBookmarks([first.id], database)).rejects.toThrow("One or more deleted bookmarks were not found");

    await softDeleteBookmark(first.id, database);
    await database.boards.update(source.id, { deletedAt: timestamp });
    await expect(restoreBookmark(first.id, database)).rejects.toThrow("Restore the parent board first");
    await database.boards.update(source.id, { deletedAt: null });
    await restoreBookmark(first.id, database);
    await expect(restoreBookmark(first.id, database)).rejects.toThrow("Deleted bookmark not found");
  });

  it("covers permanent deletion guards, missing items, empty Trash, and retention defaults", async () => {
    const initial = await ensureStarterWorkspace(database);
    const page = initial.pages[0]!;
    const board = initial.boards[0]!;
    const bookmark = await createBookmark({ boardId: board.id, title: "Active", url: "https://active.example/" }, {}, database);

    await expect(permanentlyDelete("bookmark", bookmark.id, database)).rejects.toThrow("Only Trash items");
    await expect(permanentlyDelete("board", board.id, database)).rejects.toThrow("Only Trash items");
    await expect(permanentlyDelete("page", page.id, database)).rejects.toThrow("Only Trash items");
    await expect(permanentlyDelete("bookmark", "missing", database)).resolves.toBeUndefined();
    await expect(permanentlyDelete("board", "missing", database)).resolves.toBeUndefined();
    await expect(permanentlyDelete("page", "missing", database)).resolves.toBeUndefined();
    expect(await emptyTrash(database)).toBe(0);

    await updateSettings({ trashRetentionDays: null }, database);
    expect(await purgeTrash(undefined, database)).toBe(0);
    await updateSettings({ trashRetentionDays: 7 }, database);
    expect(await purgeTrash(undefined, database)).toBe(0);
  });

  it("diagnoses orphaned, unsafe, deleted-parent, settings, wallpaper, and snapshot defects without mutation", async () => {
    const initial = await ensureStarterWorkspace(database);
    const activePage = initial.pages[0]!;
    const activeBoard = initial.boards[0]!;

    await database.boards.add(boardRecord("orphan-board", "missing-page"));
    await database.bookmarks.add(bookmarkRecord("orphan-bookmark", "missing-board", { url: "javascript:alert(1)", normalizedUrl: "javascript:alert(1)", hostname: "" }));

    const deletedPage = pageRecord("deleted-parent", { deletedAt: timestamp });
    const childBoard = boardRecord("active-child-board", deletedPage.id);
    const deletedBoard = boardRecord("deleted-parent-board", activePage.id, { deletedAt: timestamp });
    const childBookmark = bookmarkRecord("active-child-bookmark", deletedBoard.id);
    await database.pages.add(deletedPage);
    await database.boards.bulkAdd([childBoard, deletedBoard]);
    await database.bookmarks.add(childBookmark);

    const currentSettings = (await database.settings.get("app"))!;
    await database.settings.put({
      ...currentSettings,
      activePageId: "missing-page",
      quickSaveDefaultPageId: "missing-page",
      quickSaveDefaultBoardId: activeBoard.id,
      quickSaveLastPageId: activePage.id,
      quickSaveLastBoardId: "missing-board",
      theme: { ...currentSettings.theme, wallpaperId: "builtin-unknown", backgroundMode: "wallpaper" },
    });

    const invalidWallpaper: Wallpaper = {
      id: "invalid-wallpaper",
      kind: "upload",
      name: "Invalid",
      mimeType: "image/webp",
      blob: null,
      thumbnail: null,
      value: null,
      width: 0,
      height: 0,
      storedBytes: Number.MAX_SAFE_INTEGER,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    Reflect.set(invalidWallpaper, "mimeType", 42);
    await database.wallpapers.add(invalidWallpaper);

    const invalidSnapshot: Snapshot = { id: "invalid-snapshot", schemaVersion: 1, createdAt: timestamp, reason: "test", checksum: "", payload: null };
    Reflect.deleteProperty(invalidSnapshot, "checksum");
    await database.snapshots.add(invalidSnapshot);

    const before = {
      pages: await database.pages.toArray(),
      boards: await database.boards.toArray(),
      bookmarks: await database.bookmarks.toArray(),
    };
    const issues = await auditInvariants(database);
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining("Active Page setting"),
      expect.stringContaining("has no parent Page"),
      expect.stringContaining("has no parent Board"),
      expect.stringContaining("deleted parent Page"),
      expect.stringContaining("deleted parent Board"),
      expect.stringContaining("unsafe URL"),
      expect.stringContaining("Quick Save default Page"),
      expect.stringContaining("Quick Save default Board"),
      expect.stringContaining("Quick Save last Board"),
      expect.stringContaining("unknown builtin"),
      expect.stringContaining("invalid metadata"),
      expect.stringContaining("missing raster data"),
      expect.stringContaining("invalid dimensions"),
      expect.stringContaining("exceeds storage limits"),
      expect.stringContaining("Snapshot invalid-snapshot is invalid"),
    ]));
    expect(await database.pages.toArray()).toEqual(before.pages);
    expect(await database.boards.toArray()).toEqual(before.boards);
    expect(await database.bookmarks.toArray()).toEqual(before.bookmarks);
  });

  it("covers wallpaper lookup and garbage collection with implicit and explicit active references", async () => {
    await ensureStarterWorkspace(database);
    const uploaded = (id: string): Wallpaper => ({
      id,
      kind: "upload",
      name: id,
      mimeType: "image/webp",
      blob: new Blob([id]),
      thumbnail: new Blob([id]),
      value: null,
      width: 1,
      height: 1,
      sourceBytes: 1,
      storedBytes: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await database.wallpapers.bulkAdd([uploaded("keep"), uploaded("drop"), uploaded("explicit")]);
    const settings = (await database.settings.get("app"))!;
    await database.settings.update("app", { theme: { ...settings.theme, wallpaperId: "keep", backgroundMode: "wallpaper" } });

    expect(await getWallpaper("missing", database)).toBeNull();
    expect(await getWallpaper("keep", database)).toMatchObject({ id: "keep" });
    expect(await garbageCollectWallpapers(database)).toBe(2);
    await database.wallpapers.add(uploaded("drop-again"));
    expect(await garbageCollectWallpapers(database, null)).toBe(2);
    expect(await database.wallpapers.count()).toBe(0);
  });
});
