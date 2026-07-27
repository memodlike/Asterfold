import Dexie from "dexie";
import type {
  AppSettings,
  Board,
  Bookmark,
  BookmarkPatch,
  NewBookmarkInput,
  Page,
  Wallpaper,
  WorkspaceData,
} from "../domain/models";
import { DuplicateError, PersistenceError, ValidationError } from "../domain/errors";
import { allocateAtEnd, allocateManyAtEnd, compareRanks, evenlySpacedRanks, moveMany, validateScope } from "../domain/ordering";
import { normalizeUrl } from "../domain/urls";
import { validateTheme } from "../domain/themes";
import { appSettingsSchema, snapshotSchema, wallpaperMetadataSchema } from "../domain/schemas";
import { WALLPAPER_LIMITS } from "../domain/mediaLimits";
import { normalizeDescription, normalizeEntityTitle } from "../domain/text";
import { createId, nowIso } from "../utils/ids";
import { processWallpaper } from "../services/wallpaper";
import { createDefaultSettings } from "./defaults";
import { db, type AsterfoldDatabase } from "./database";

function sortByPosition<T extends { position: string }>(items: T[]): T[] {
  return items.sort((left, right) => compareRanks(left.position, right.position));
}

async function activePages(database: AsterfoldDatabase): Promise<Page[]> {
  return sortByPosition((await database.pages.toArray()).filter((page) => page.deletedAt === null));
}

async function activeBoards(database: AsterfoldDatabase, pageId?: string): Promise<Board[]> {
  const boards = pageId === undefined
    ? await database.boards.toArray()
    : await database.boards.where("pageId").equals(pageId).toArray();
  return sortByPosition(boards.filter((board) => board.deletedAt === null));
}

async function activeBookmarks(database: AsterfoldDatabase, boardId?: string): Promise<Bookmark[]> {
  const bookmarks = boardId === undefined
    ? await database.bookmarks.toArray()
    : await database.bookmarks.where("boardId").equals(boardId).toArray();
  return sortByPosition(bookmarks.filter((bookmark) => bookmark.deletedAt === null));
}

async function repairWorkspaceInvariants(database: AsterfoldDatabase): Promise<void> {
  const [pages, boards, settings] = await Promise.all([
    activePages(database),
    activeBoards(database),
    database.settings.get("app"),
  ]);
  if (pages.length === 0 || !settings) return;

  const pageIds = new Set(pages.map((page) => page.id));
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const defaultPage = pages.find((page) => page.isDefault) ?? pages[0]!;
  const timestamp = nowIso();
  const pageRepairs = pages
    .filter((page) => page.isDefault !== (page.id === defaultPage.id))
    .map((page) => ({ ...page, isDefault: page.id === defaultPage.id, updatedAt: timestamp, version: page.version + 1 }));
  if (pageRepairs.length > 0) await database.pages.bulkPut(pageRepairs);

  const resolvePair = (pageId: string | null, boardId: string | null): [string, string | null] => {
    const resolvedPageId = pageId && pageIds.has(pageId) ? pageId : defaultPage.id;
    const board = boardId ? boardById.get(boardId) : undefined;
    if (board?.pageId === resolvedPageId) return [resolvedPageId, board.id];
    return [resolvedPageId, boards.find((candidate) => candidate.pageId === resolvedPageId)?.id ?? null];
  };
  const [defaultPageId, defaultBoardId] = resolvePair(settings.quickSaveDefaultPageId, settings.quickSaveDefaultBoardId);
  const [lastPageId, lastBoardId] = resolvePair(settings.quickSaveLastPageId, settings.quickSaveLastBoardId);
  const activePageId = settings.activePageId && pageIds.has(settings.activePageId) ? settings.activePageId : defaultPage.id;
  const patch = {
    activePageId,
    quickSaveDefaultPageId: defaultPageId,
    quickSaveDefaultBoardId: defaultBoardId,
    quickSaveLastPageId: lastPageId,
    quickSaveLastBoardId: lastBoardId,
  };
  if (Object.entries(patch).some(([key, value]) => settings[key as keyof typeof patch] !== value)) {
    await database.settings.update("app", { ...patch, updatedAt: timestamp });
  }
}

export async function ensureStarterWorkspace(database: AsterfoldDatabase = db): Promise<WorkspaceData> {
  await database.transaction("rw", database.pages, database.boards, database.settings, async () => {
    let settings = await database.settings.get("app");
    if (!settings) {
      settings = createDefaultSettings();
      await database.settings.add(settings);
    }

    const pages = await activePages(database);
    if (pages.length === 0) {
      const timestamp = nowIso();
      const pageId = createId();
      const boardId = createId();
      const [pagePosition] = evenlySpacedRanks(1);
      const [boardPosition] = evenlySpacedRanks(1);
      if (!pagePosition || !boardPosition) throw new PersistenceError("Unable to allocate starter positions");

      await database.pages.add({
        id: pageId,
        userId: null,
        title: "Workspace",
        icon: "briefcase",
        accent: "#155eef",
        position: pagePosition,
        isDefault: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        deletedBatchId: null,
        version: 1,
      });
      await database.boards.add({
        id: boardId,
        userId: null,
        pageId,
        title: "Inbox",
        icon: "inbox",
        accent: null,
        position: boardPosition,
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
      });
      await database.settings.update("app", {
        activePageId: pageId,
        quickSaveDefaultPageId: pageId,
        quickSaveDefaultBoardId: boardId,
        quickSaveLastPageId: pageId,
        quickSaveLastBoardId: boardId,
        updatedAt: timestamp,
      });
    } else if (!pages.some((page) => page.id === settings.activePageId)) {
      await database.settings.update("app", { activePageId: pages[0]?.id ?? null, updatedAt: nowIso() });
    }
    await repairWorkspaceInvariants(database);
  });

  return getWorkspaceData(database, false);
}

export async function getWorkspaceData(database: AsterfoldDatabase = db, seed = true): Promise<WorkspaceData> {
  if (seed) await ensureStarterWorkspace(database);
  const [pages, boards, bookmarks, settings] = await Promise.all([
    activePages(database),
    activeBoards(database),
    activeBookmarks(database),
    database.settings.get("app"),
  ]);
  if (!settings) throw new PersistenceError("Application settings are unavailable");
  return { pages, boards, bookmarks, settings };
}

export async function updateSettings(
  patch: Partial<Omit<AppSettings, "id" | "schemaVersion">>,
  database: AsterfoldDatabase = db,
): Promise<AppSettings> {
  await ensureStarterWorkspace(database);
  return database.transaction("rw", [database.settings, database.wallpapers], async () => {
    const current = await database.settings.get("app");
    if (!current) throw new PersistenceError("Application settings are unavailable");
    const next: AppSettings = appSettingsSchema.parse({
      ...current,
      ...patch,
      theme: patch.theme ? validateTheme(patch.theme) : current.theme,
      id: "app",
      schemaVersion: current.schemaVersion,
      updatedAt: nowIso(),
    });
    await database.settings.put(next);
    if (patch.theme) {
      const orphanIds = (await database.wallpapers
        .filter((wallpaper) => wallpaper.kind === "upload" && wallpaper.id !== next.theme.wallpaperId)
        .primaryKeys()) as string[];
      if (orphanIds.length > 0) await database.wallpapers.bulkDelete(orphanIds);
    }
    return next;
  });
}

export async function createPage(
  title: string,
  options: { icon?: string | null; accent?: string | null; setDefault?: boolean } = {},
  database: AsterfoldDatabase = db,
): Promise<Page> {
  await ensureStarterWorkspace(database);
  return database.transaction("rw", database.pages, database.settings, async () => {
    const pages = await activePages(database);
    const timestamp = nowIso();
    const allocation = allocateAtEnd(pages);
    const rebalanced = allocation.scope
      .filter((page, index) => page.position !== pages[index]?.position)
      .map((page) => ({ ...page, updatedAt: timestamp, version: page.version + 1 }));
    if (rebalanced.length > 0) await database.pages.bulkPut(rebalanced);
    const position = allocation.position;
    const page: Page = {
      id: createId(),
      userId: null,
      title: normalizeEntityTitle(title, "Untitled page"),
      icon: options.icon ?? "folder",
      accent: options.accent ?? null,
      position,
      isDefault: options.setDefault ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      deletedBatchId: null,
      version: 1,
    };
    if (page.isDefault) {
      await database.pages.filter((candidate) => candidate.isDefault).modify((candidate) => {
        candidate.isDefault = false;
        candidate.updatedAt = timestamp;
        candidate.version += 1;
      });
    }
    await database.pages.add(page);
    await database.settings.update("app", { activePageId: page.id, updatedAt: timestamp });
    return page;
  });
}

export async function renamePage(id: string, title: string, database: AsterfoldDatabase = db): Promise<void> {
  const page = await database.pages.get(id);
  if (!page || page.deletedAt !== null) throw new ValidationError("Page not found");
  await database.pages.update(id, { title: normalizeEntityTitle(title, page.title), updatedAt: nowIso(), version: page.version + 1 });
}

export async function setDefaultPage(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", [database.pages, database.boards, database.settings], async () => {
    const page = await database.pages.get(id);
    if (!page || page.deletedAt !== null) throw new ValidationError("Page not found");
    const timestamp = nowIso();
    await database.pages.filter((candidate) => candidate.isDefault && candidate.id !== id).modify((candidate) => {
      candidate.isDefault = false;
      candidate.updatedAt = timestamp;
      candidate.version += 1;
    });
    if (!page.isDefault) await database.pages.update(id, { isDefault: true, updatedAt: timestamp, version: page.version + 1 });
    const defaultBoardId = (await activeBoards(database, id))[0]?.id ?? null;
    await database.settings.update("app", {
      quickSaveDefaultPageId: id,
      quickSaveDefaultBoardId: defaultBoardId,
      updatedAt: timestamp,
    });
  });
}

export async function movePageToIndex(id: string, targetIndex: number, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.pages, async () => {
    const current = await database.pages.get(id);
    if (!current || current.deletedAt !== null) throw new ValidationError("Page not found");
    const pages = await activePages(database);
    const moved = moveMany(pages, [id], targetIndex);
    const timestamp = nowIso();
    await database.pages.bulkPut(moved.map((page) => page.position === pages.find((candidate) => candidate.id === page.id)?.position
      ? page
      : { ...page, updatedAt: timestamp, version: page.version + 1 }));
  });
}

export async function duplicatePage(id: string, database: AsterfoldDatabase = db): Promise<Page> {
  await ensureStarterWorkspace(database);
  return database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const source = await database.pages.get(id);
    if (!source || source.deletedAt !== null) throw new ValidationError("Page not found");
    const timestamp = nowIso();
    const pageId = createId();
    const pages = await activePages(database);
    const allocation = allocateAtEnd(pages);
    const rebalanced = allocation.scope
      .filter((page, index) => page.position !== pages[index]?.position)
      .map((page) => ({ ...page, updatedAt: timestamp, version: page.version + 1 }));
    if (rebalanced.length > 0) await database.pages.bulkPut(rebalanced);
    const page: Page = {
      ...source,
      id: pageId,
      title: normalizeEntityTitle(`${source.title} copy`, source.title),
      position: allocation.position,
      isDefault: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    await database.pages.add(page);
    const boards = await activeBoards(database, id);
    for (const board of boards) {
      const boardId = createId();
      await database.boards.add({ ...board, id: boardId, pageId, createdAt: timestamp, updatedAt: timestamp, version: 1 });
      const bookmarks = await activeBookmarks(database, board.id);
      if (bookmarks.length > 0) {
        await database.bookmarks.bulkAdd(bookmarks.map((bookmark) => ({ ...bookmark, id: createId(), boardId, createdAt: timestamp, updatedAt: timestamp, version: 1 })));
      }
    }
    await database.settings.update("app", { activePageId: pageId, updatedAt: timestamp });
    return page;
  });
}

export async function softDeletePage(id: string, database: AsterfoldDatabase = db): Promise<string> {
  await ensureStarterWorkspace(database);
  return database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const page = await database.pages.get(id);
    if (!page || page.deletedAt !== null) throw new ValidationError("Page not found");
    const pages = await activePages(database);
    if (pages.length === 1) {
      const replacement = await createReplacementPage(database);
      await database.settings.update("app", { activePageId: replacement.id, updatedAt: nowIso() });
    }
    const timestamp = nowIso();
    const batchId = createId();
    const boards = await activeBoards(database, id);
    const boardIds = boards.map((board) => board.id);
    await database.pages.update(id, { deletedAt: timestamp, deletedBatchId: batchId, isDefault: false, updatedAt: timestamp, version: page.version + 1 });
    await database.boards.where("pageId").equals(id).filter((board) => board.deletedAt === null).modify((board) => {
      board.deletedAt = timestamp;
      board.deletedBatchId = batchId;
      board.updatedAt = timestamp;
      board.version += 1;
    });
    if (boardIds.length > 0) {
      await database.bookmarks.where("boardId").anyOf(boardIds).filter((bookmark) => bookmark.deletedAt === null).modify((bookmark) => {
        bookmark.deletedAt = timestamp;
        bookmark.deletedBatchId = batchId;
        bookmark.updatedAt = timestamp;
        bookmark.version += 1;
      });
    }
    const remaining = (await activePages(database)).filter((candidate) => candidate.id !== id);
    const next = remaining[0];
    const settings = await database.settings.get("app");
    if (settings?.activePageId === id) await database.settings.update("app", { activePageId: next?.id ?? null, updatedAt: timestamp });
    await repairWorkspaceInvariants(database);
    return batchId;
  });
}

async function createReplacementPage(database: AsterfoldDatabase): Promise<Page> {
  const timestamp = nowIso();
  const pageId = createId();
  const boardId = createId();
  const page: Page = {
    id: pageId,
    userId: null,
    title: "Workspace",
    icon: "folder",
    accent: "#155eef",
    position: evenlySpacedRanks(1)[0]!,
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
  };
  await database.pages.add(page);
  await database.boards.add({
    id: boardId,
    userId: null,
    pageId,
    title: "Inbox",
    icon: "inbox",
    accent: null,
    position: evenlySpacedRanks(1)[0]!,
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
  });
  return page;
}

export async function restorePage(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const page = await database.pages.get(id);
    if (!page || page.deletedAt === null) throw new ValidationError("Deleted page not found");
    const batchId = page.deletedBatchId;
    const timestamp = nowIso();
    const activePageScope = await activePages(database);
    const pageAllocation = allocateAtEnd(activePageScope);
    const previousPagePositions = new Map(activePageScope.map((item) => [item.id, item.position]));
    const rebalancedPages = pageAllocation.scope
      .filter((item) => previousPagePositions.get(item.id) !== item.position)
      .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
    if (rebalancedPages.length > 0) await database.pages.bulkPut(rebalancedPages);
    await database.pages.update(id, { position: pageAllocation.position, deletedAt: null, deletedBatchId: null, updatedAt: timestamp, version: page.version + 1 });
    if (batchId) {
      const boardsToRestore = await database.boards.where("pageId").equals(id).filter((board) => board.deletedBatchId === batchId).toArray();
      const activeBoardScope = await activeBoards(database, id);
      const boardAllocation = allocateManyAtEnd(activeBoardScope, boardsToRestore.length);
      const previousBoardPositions = new Map(activeBoardScope.map((item) => [item.id, item.position]));
      const rebalancedBoards = boardAllocation.scope
        .filter((item) => previousBoardPositions.get(item.id) !== item.position)
        .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
      if (rebalancedBoards.length > 0) await database.boards.bulkPut(rebalancedBoards);
      const restoredBoards = boardsToRestore.map((board, index) => ({
        ...board,
        position: boardAllocation.positions[index]!,
        deletedAt: null,
        deletedBatchId: null,
        updatedAt: timestamp,
        version: board.version + 1,
      }));
      if (restoredBoards.length > 0) await database.boards.bulkPut(restoredBoards);
      for (const board of restoredBoards) {
        const bookmarksToRestore = await database.bookmarks.where("boardId").equals(board.id).filter((bookmark) => bookmark.deletedBatchId === batchId).toArray();
        const activeBookmarkScope = await activeBookmarks(database, board.id);
        const bookmarkAllocation = allocateManyAtEnd(activeBookmarkScope, bookmarksToRestore.length);
        const previousBookmarkPositions = new Map(activeBookmarkScope.map((item) => [item.id, item.position]));
        const rebalancedBookmarks = bookmarkAllocation.scope
          .filter((item) => previousBookmarkPositions.get(item.id) !== item.position)
          .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
        if (rebalancedBookmarks.length > 0) await database.bookmarks.bulkPut(rebalancedBookmarks);
        if (bookmarksToRestore.length > 0) {
          await database.bookmarks.bulkPut(bookmarksToRestore.map((bookmark, index) => ({
            ...bookmark,
            position: bookmarkAllocation.positions[index]!,
            deletedAt: null,
            deletedBatchId: null,
            updatedAt: timestamp,
            version: bookmark.version + 1,
          })));
        }
      }
    }
    await database.settings.update("app", { activePageId: id, updatedAt: timestamp });
    await repairWorkspaceInvariants(database);
  });
}

export async function createBoard(
  pageId: string,
  title: string,
  database: AsterfoldDatabase = db,
): Promise<Board> {
  return database.transaction("rw", database.pages, database.boards, async () => {
    const page = await database.pages.get(pageId);
    if (!page || page.deletedAt !== null) throw new ValidationError("Page not found");
    const boards = await activeBoards(database, pageId);
    const timestamp = nowIso();
    const allocation = allocateAtEnd(boards);
    const rebalanced = allocation.scope
      .filter((board, index) => board.position !== boards[index]?.position)
      .map((board) => ({ ...board, updatedAt: timestamp, version: board.version + 1 }));
    if (rebalanced.length > 0) await database.boards.bulkPut(rebalanced);
    const position = allocation.position;
    const board: Board = {
      id: createId(),
      userId: null,
      pageId,
      title: normalizeEntityTitle(title, "Untitled board"),
      icon: "layout-list",
      accent: null,
      position,
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
    };
    await database.boards.add(board);
    return board;
  });
}

export async function updateBoard(
  id: string,
  patch: Partial<Pick<Board, "title" | "collapsed" | "layout" | "bookmarkColumns" | "gridColumn" | "gridRow" | "gridSpan" | "icon" | "accent">>,
  database: AsterfoldDatabase = db,
): Promise<void> {
  const board = await database.boards.get(id);
  if (!board || board.deletedAt !== null) throw new ValidationError("Board not found");
  await database.boards.update(id, {
    ...patch,
    title: patch.title === undefined ? board.title : normalizeEntityTitle(patch.title, board.title),
    gridColumn: patch.gridColumn === undefined ? board.gridColumn : Math.min(12, Math.max(1, Math.round(patch.gridColumn))),
    gridRow: patch.gridRow === undefined ? board.gridRow : patch.gridRow === 1 ? 1 : 0,
    gridSpan: patch.gridSpan === undefined ? board.gridSpan : Math.min(6, Math.max(2, Math.round(patch.gridSpan))),
    updatedAt: nowIso(),
    version: board.version + 1,
  });
}

export async function moveBoardWithGridSwap(
  id: string,
  targetId: string,
  targetPageId: string,
  targetIndex: number,
  database: AsterfoldDatabase = db,
): Promise<void> {
  if (id === targetId) return;
  await database.transaction("rw", database.pages, database.boards, async () => {
    const [page, current, target] = await Promise.all([
      database.pages.get(targetPageId),
      database.boards.get(id),
      database.boards.get(targetId),
    ]);
    if (!page || page.deletedAt !== null || !current || current.deletedAt !== null || !target || target.deletedAt !== null
      || target.pageId !== targetPageId || current.pageId !== targetPageId) {
      throw new ValidationError("Boards for grid move were not found on the active Page");
    }
    const targetBoards = (await activeBoards(database, targetPageId)).filter((board) => board.id !== id);
    const moved = moveMany([...targetBoards, current], [id], targetIndex);
    const originals = new Map([...targetBoards, current].map((board) => [board.id, board]));
    const timestamp = nowIso();
    await database.boards.bulkPut(moved.map((board) => {
      const original = originals.get(board.id)!;
      const placement = board.id === current.id
        ? { gridColumn: target.gridColumn, gridRow: target.gridRow, gridSpan: target.gridSpan }
        : board.id === target.id
          ? { gridColumn: current.gridColumn, gridRow: current.gridRow, gridSpan: current.gridSpan }
          : { gridColumn: board.gridColumn, gridRow: board.gridRow, gridSpan: board.gridSpan };
      const changed = original.position !== board.position
        || original.pageId !== targetPageId
        || original.gridColumn !== placement.gridColumn
        || original.gridRow !== placement.gridRow
        || original.gridSpan !== placement.gridSpan;
      return {
        ...board,
        ...placement,
        pageId: targetPageId,
        updatedAt: changed ? timestamp : board.updatedAt,
        version: changed ? board.version + 1 : board.version,
      };
    }));
  });
}

export async function moveBoardToIndex(
  id: string,
  targetPageId: string,
  targetIndex: number,
  database: AsterfoldDatabase = db,
): Promise<void> {
  await database.transaction("rw", database.pages, database.boards, async () => {
    const page = await database.pages.get(targetPageId);
    const current = await database.boards.get(id);
    if (!page || page.deletedAt !== null || !current || current.deletedAt !== null) throw new ValidationError("Board or target page not found");
    const targetBoards = (await activeBoards(database, targetPageId)).filter((board) => board.id !== id);
    const moved = moveMany([...targetBoards, { ...current, pageId: targetPageId }], [id], targetIndex);
    const timestamp = nowIso();
    await database.boards.bulkPut(moved.map((board) => {
      const original = board.id === id ? current : targetBoards.find((candidate) => candidate.id === board.id);
      return original?.position === board.position && original.pageId === board.pageId
        ? board
        : { ...board, updatedAt: timestamp, version: board.version + 1 };
    }));
  });
}

export async function duplicateBoard(id: string, database: AsterfoldDatabase = db): Promise<Board> {
  return database.transaction("rw", database.boards, database.bookmarks, async () => {
    const source = await database.boards.get(id);
    if (!source || source.deletedAt !== null) throw new ValidationError("Board not found");
    const siblings = await activeBoards(database, source.pageId);
    const timestamp = nowIso();
    const allocation = allocateAtEnd(siblings);
    const rebalanced = allocation.scope
      .filter((board, index) => board.position !== siblings[index]?.position)
      .map((board) => ({ ...board, updatedAt: timestamp, version: board.version + 1 }));
    if (rebalanced.length > 0) await database.boards.bulkPut(rebalanced);
    const copy: Board = {
      ...source,
      id: createId(),
      title: normalizeEntityTitle(`${source.title} copy`, source.title),
      position: allocation.position,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    await database.boards.add(copy);
    const bookmarks = await activeBookmarks(database, id);
    if (bookmarks.length > 0) {
      await database.bookmarks.bulkAdd(bookmarks.map((bookmark) => ({ ...bookmark, id: createId(), boardId: copy.id, createdAt: timestamp, updatedAt: timestamp, version: 1 })));
    }
    return copy;
  });
}

export async function softDeleteBoard(id: string, database: AsterfoldDatabase = db): Promise<string> {
  return database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const board = await database.boards.get(id);
    if (!board || board.deletedAt !== null) throw new ValidationError("Board not found");
    const timestamp = nowIso();
    const batchId = createId();
    await database.boards.update(id, { deletedAt: timestamp, deletedBatchId: batchId, updatedAt: timestamp, version: board.version + 1 });
    await database.bookmarks.where("boardId").equals(id).filter((bookmark) => bookmark.deletedAt === null).modify((bookmark) => {
      bookmark.deletedAt = timestamp;
      bookmark.deletedBatchId = batchId;
      bookmark.updatedAt = timestamp;
      bookmark.version += 1;
    });
    await repairWorkspaceInvariants(database);
    return batchId;
  });
}

export async function restoreBoard(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const board = await database.boards.get(id);
    if (!board || board.deletedAt === null) throw new ValidationError("Deleted board not found");
    const parent = await database.pages.get(board.pageId);
    if (!parent || parent.deletedAt !== null) throw new ValidationError("Restore the parent page first");
    const timestamp = nowIso();
    const batchId = board.deletedBatchId;
    const activeBoardScope = await activeBoards(database, board.pageId);
    const boardAllocation = allocateAtEnd(activeBoardScope);
    const previousBoardPositions = new Map(activeBoardScope.map((item) => [item.id, item.position]));
    const rebalancedBoards = boardAllocation.scope
      .filter((item) => previousBoardPositions.get(item.id) !== item.position)
      .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
    if (rebalancedBoards.length > 0) await database.boards.bulkPut(rebalancedBoards);
    await database.boards.update(id, { position: boardAllocation.position, deletedAt: null, deletedBatchId: null, updatedAt: timestamp, version: board.version + 1 });
    if (batchId) {
      const bookmarksToRestore = await database.bookmarks.where("boardId").equals(id).filter((bookmark) => bookmark.deletedBatchId === batchId).toArray();
      const activeBookmarkScope = await activeBookmarks(database, id);
      const bookmarkAllocation = allocateManyAtEnd(activeBookmarkScope, bookmarksToRestore.length);
      const previousBookmarkPositions = new Map(activeBookmarkScope.map((item) => [item.id, item.position]));
      const rebalancedBookmarks = bookmarkAllocation.scope
        .filter((item) => previousBookmarkPositions.get(item.id) !== item.position)
        .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
      if (rebalancedBookmarks.length > 0) await database.bookmarks.bulkPut(rebalancedBookmarks);
      if (bookmarksToRestore.length > 0) {
        await database.bookmarks.bulkPut(bookmarksToRestore.map((bookmark, index) => ({
          ...bookmark,
          position: bookmarkAllocation.positions[index]!,
          deletedAt: null,
          deletedBatchId: null,
          updatedAt: timestamp,
          version: bookmark.version + 1,
        })));
      }
    }
    await repairWorkspaceInvariants(database);
  });
}

export async function findDuplicate(
  boardId: string,
  url: string,
  database: AsterfoldDatabase = db,
  excludeBookmarkId?: string,
): Promise<Bookmark | null> {
  const normalized = normalizeUrl(url).normalizedUrl;
  const match = await database.bookmarks
    .where("[boardId+normalizedUrl]")
    .equals([boardId, normalized])
    .filter((bookmark) => bookmark.deletedAt === null && bookmark.id !== excludeBookmarkId)
    .first();
  return match ?? null;
}

export async function createBookmark(
  input: NewBookmarkInput,
  options: { allowDuplicate?: boolean } = {},
  database: AsterfoldDatabase = db,
): Promise<Bookmark> {
  return database.transaction("rw", database.boards, database.bookmarks, async () => {
    const board = await database.boards.get(input.boardId);
    if (!board || board.deletedAt !== null) throw new ValidationError("Board not found");
    const normalized = normalizeUrl(input.url);
    if (!options.allowDuplicate) {
      const duplicate = await database.bookmarks
        .where("[boardId+normalizedUrl]")
        .equals([input.boardId, normalized.normalizedUrl])
        .filter((bookmark) => bookmark.deletedAt === null)
        .first();
      if (duplicate) throw new DuplicateError("This bookmark already exists in the selected board", duplicate.id);
    }
    const siblings = await activeBookmarks(database, input.boardId);
    const timestamp = nowIso();
    const allocation = allocateAtEnd(siblings);
    const rebalanced = allocation.scope
      .filter((bookmark, index) => bookmark.position !== siblings[index]?.position)
      .map((bookmark) => ({ ...bookmark, updatedAt: timestamp, version: bookmark.version + 1 }));
    if (rebalanced.length > 0) await database.bookmarks.bulkPut(rebalanced);
    const position = allocation.position;
    const bookmark: Bookmark = {
      id: createId(),
      userId: null,
      boardId: input.boardId,
      title: normalizeEntityTitle(input.title, normalized.hostname || "Untitled bookmark"),
      url: normalized.url,
      normalizedUrl: normalized.normalizedUrl,
      hostname: normalized.hostname,
      description: normalizeDescription(input.description),
      faviconUrl: null,
      customIcon: null,
      position,
      openMode: input.openMode ?? "current",
      pinned: input.pinned ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      deletedBatchId: null,
      version: 1,
    };
    await database.bookmarks.add(bookmark);
    return bookmark;
  });
}

export async function updateBookmark(
  id: string,
  patch: BookmarkPatch,
  database: AsterfoldDatabase = db,
): Promise<Bookmark> {
  return database.transaction("rw", database.boards, database.bookmarks, async () => {
    const current = await database.bookmarks.get(id);
    if (!current || current.deletedAt !== null) throw new ValidationError("Bookmark not found");
    const targetBoardId = patch.boardId ?? current.boardId;
    const board = await database.boards.get(targetBoardId);
    if (!board || board.deletedAt !== null) throw new ValidationError("Target board not found");
    const normalized = patch.url === undefined ? null : normalizeUrl(patch.url);
    if (patch.url !== undefined || patch.boardId !== undefined) {
      const duplicate = await database.bookmarks
        .where("[boardId+normalizedUrl]")
        .equals([targetBoardId, normalized?.normalizedUrl ?? current.normalizedUrl])
        .filter((bookmark) => bookmark.deletedAt === null && bookmark.id !== id)
        .first();
      if (duplicate) throw new DuplicateError("This bookmark already exists in the selected board", duplicate.id);
    }
    let position = current.position;
    if (targetBoardId !== current.boardId) {
      const siblings = await activeBookmarks(database, targetBoardId);
      const allocation = allocateAtEnd(siblings);
      const timestamp = nowIso();
      const rebalanced = allocation.scope
        .filter((bookmark, index) => bookmark.position !== siblings[index]?.position)
        .map((bookmark) => ({ ...bookmark, updatedAt: timestamp, version: bookmark.version + 1 }));
      if (rebalanced.length > 0) await database.bookmarks.bulkPut(rebalanced);
      position = allocation.position;
    }
    const updated: Bookmark = {
      ...current,
      ...patch,
      boardId: targetBoardId,
      position,
      title: patch.title === undefined ? current.title : normalizeEntityTitle(patch.title, current.title),
      description: patch.description === undefined ? current.description : normalizeDescription(patch.description),
      url: normalized?.url ?? current.url,
      normalizedUrl: normalized?.normalizedUrl ?? current.normalizedUrl,
      hostname: normalized?.hostname ?? current.hostname,
      updatedAt: nowIso(),
      version: current.version + 1,
    };
    await database.bookmarks.put(updated);
    return updated;
  });
}

export async function moveBookmarkToIndex(
  id: string,
  targetBoardId: string,
  targetIndex: number,
  database: AsterfoldDatabase = db,
): Promise<void> {
  await database.transaction("rw", database.boards, database.bookmarks, async () => {
    const board = await database.boards.get(targetBoardId);
    const current = await database.bookmarks.get(id);
    if (!board || board.deletedAt !== null || !current || current.deletedAt !== null) throw new ValidationError("Bookmark or target board not found");
    const targetItems = (await activeBookmarks(database, targetBoardId)).filter((bookmark) => bookmark.id !== id);
    const moved = moveMany([...targetItems, { ...current, boardId: targetBoardId }], [id], targetIndex);
    const timestamp = nowIso();
    await database.bookmarks.bulkPut(moved.map((bookmark) => {
      const original = bookmark.id === id ? current : targetItems.find((candidate) => candidate.id === bookmark.id);
      return original?.position === bookmark.position && original.boardId === bookmark.boardId
        ? bookmark
        : { ...bookmark, updatedAt: timestamp, version: bookmark.version + 1 };
    }));
  });
}

export async function duplicateBookmark(id: string, database: AsterfoldDatabase = db): Promise<Bookmark> {
  const source = await database.bookmarks.get(id);
  if (!source || source.deletedAt !== null) throw new ValidationError("Bookmark not found");
  return createBookmark({
    boardId: source.boardId,
    title: `${source.title} copy`,
    url: source.url,
    description: source.description,
    openMode: source.openMode,
    pinned: source.pinned,
  }, { allowDuplicate: true }, database);
}

export async function softDeleteBookmark(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.bookmarks, async () => {
    const bookmark = await database.bookmarks.get(id);
    if (!bookmark || bookmark.deletedAt !== null) throw new ValidationError("Bookmark not found");
    const timestamp = nowIso();
    await database.bookmarks.update(id, { deletedAt: timestamp, deletedBatchId: createId(), updatedAt: timestamp, version: bookmark.version + 1 });
  });
}

export async function restoreBookmark(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.boards, database.bookmarks, async () => {
    const bookmark = await database.bookmarks.get(id);
    if (!bookmark || bookmark.deletedAt === null) throw new ValidationError("Deleted bookmark not found");
    const board = await database.boards.get(bookmark.boardId);
    if (!board || board.deletedAt !== null) throw new ValidationError("Restore the parent board first");
    const timestamp = nowIso();
    const activeBookmarkScope = await activeBookmarks(database, bookmark.boardId);
    const allocation = allocateAtEnd(activeBookmarkScope);
    const previousPositions = new Map(activeBookmarkScope.map((item) => [item.id, item.position]));
    const rebalanced = allocation.scope
      .filter((item) => previousPositions.get(item.id) !== item.position)
      .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
    if (rebalanced.length > 0) await database.bookmarks.bulkPut(rebalanced);
    await database.bookmarks.update(id, { position: allocation.position, deletedAt: null, deletedBatchId: null, updatedAt: timestamp, version: bookmark.version + 1 });
  });
}

export async function bulkRestoreBookmarks(ids: readonly string[], database: AsterfoldDatabase = db): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  await database.transaction("rw", database.boards, database.bookmarks, async () => {
    const bookmarks = await database.bookmarks.where("id").anyOf(uniqueIds).toArray();
    if (bookmarks.length !== uniqueIds.length || bookmarks.some((bookmark) => bookmark.deletedAt === null)) {
      throw new ValidationError("One or more deleted bookmarks were not found");
    }
    const boardIds = [...new Set(bookmarks.map((bookmark) => bookmark.boardId))];
    const boards = await database.boards.where("id").anyOf(boardIds).toArray();
    if (boards.length !== boardIds.length || boards.some((board) => board.deletedAt !== null)) {
      throw new ValidationError("Restore the parent Board first");
    }
    const timestamp = nowIso();
    for (const boardId of boardIds) {
      const restoring = sortByPosition(bookmarks.filter((bookmark) => bookmark.boardId === boardId));
      const activeBookmarkScope = await activeBookmarks(database, boardId);
      const allocation = allocateManyAtEnd(activeBookmarkScope, restoring.length);
      const previousPositions = new Map(activeBookmarkScope.map((item) => [item.id, item.position]));
      const rebalanced = allocation.scope
        .filter((item) => previousPositions.get(item.id) !== item.position)
        .map((item) => ({ ...item, updatedAt: timestamp, version: item.version + 1 }));
      if (rebalanced.length > 0) await database.bookmarks.bulkPut(rebalanced);
      await database.bookmarks.bulkPut(restoring.map((bookmark, index) => ({
        ...bookmark,
        position: allocation.positions[index]!,
        deletedAt: null,
        deletedBatchId: null,
        updatedAt: timestamp,
        version: bookmark.version + 1,
      })));
    }
  });
}

export async function bulkMoveBookmarks(ids: string[], boardId: string, database: AsterfoldDatabase = db): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  await database.transaction("rw", database.boards, database.bookmarks, async () => {
    const board = await database.boards.get(boardId);
    if (!board || board.deletedAt !== null) throw new ValidationError("Target board not found");
    const selected = await database.bookmarks.where("id").anyOf(uniqueIds).toArray();
    if (selected.length !== uniqueIds.length || selected.some((bookmark) => bookmark.deletedAt !== null)) {
      throw new ValidationError("One or more bookmarks were not found");
    }
    const selectedIds = new Set(uniqueIds);
    const targetItems = (await activeBookmarks(database, boardId)).filter((bookmark) => !selectedIds.has(bookmark.id));
    const orderedSelection = sortByPosition(selected);
    const moved = moveMany([...targetItems, ...orderedSelection], orderedSelection.map((bookmark) => bookmark.id), targetItems.length);
    const timestamp = nowIso();
    const originals = new Map([...targetItems, ...selected].map((bookmark) => [bookmark.id, bookmark]));
    await database.bookmarks.bulkPut(moved.map((bookmark) => {
      const original = originals.get(bookmark.id)!;
      const nextBoardId = selectedIds.has(bookmark.id) ? boardId : bookmark.boardId;
      const changed = original.position !== bookmark.position || original.boardId !== nextBoardId;
      return {
        ...bookmark,
        boardId: nextBoardId,
        updatedAt: changed ? timestamp : bookmark.updatedAt,
        version: changed ? bookmark.version + 1 : bookmark.version,
      };
    }));
  });
}

export async function bulkDeleteBookmarks(ids: string[], database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.bookmarks, async () => {
    const timestamp = nowIso();
    const batchId = createId();
    await database.bookmarks.where("id").anyOf([...new Set(ids)]).filter((bookmark) => bookmark.deletedAt === null).modify((bookmark) => {
      bookmark.deletedAt = timestamp;
      bookmark.deletedBatchId = batchId;
      bookmark.updatedAt = timestamp;
      bookmark.version += 1;
    });
  });
}

export async function listTrash(database: AsterfoldDatabase = db): Promise<{ pages: Page[]; boards: Board[]; bookmarks: Bookmark[] }> {
  const [pages, boards, bookmarks] = await Promise.all([
    database.pages.filter((item) => item.deletedAt !== null).toArray(),
    database.boards.filter((item) => item.deletedAt !== null).toArray(),
    database.bookmarks.filter((item) => item.deletedAt !== null).toArray(),
  ]);
  const byDeleted = <T extends { deletedAt: string | null }>(left: T, right: T): number => (right.deletedAt ?? "").localeCompare(left.deletedAt ?? "");
  return { pages: pages.sort(byDeleted), boards: boards.sort(byDeleted), bookmarks: bookmarks.sort(byDeleted) };
}

export async function purgeTrash(retentionDays?: number | null, database: AsterfoldDatabase = db): Promise<number> {
  const settings = await database.settings.get("app");
  const retention = retentionDays === undefined ? settings?.trashRetentionDays ?? 30 : retentionDays;
  if (retention === null) return 0;
  const cutoff = new Date(Date.now() - retention * 86_400_000).toISOString();
  return database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const pageIds = (await database.pages.filter((item) => item.deletedAt !== null && item.deletedAt < cutoff).primaryKeys()) as string[];
    const boardIds = new Set(await database.boards.filter((item) => item.deletedAt !== null && item.deletedAt < cutoff).primaryKeys() as string[]);
    if (pageIds.length > 0) {
      for (const id of await database.boards.where("pageId").anyOf(pageIds).primaryKeys() as string[]) boardIds.add(id);
    }
    const bookmarkIds = new Set(await database.bookmarks.filter((item) => item.deletedAt !== null && item.deletedAt < cutoff).primaryKeys() as string[]);
    if (boardIds.size > 0) {
      for (const id of await database.bookmarks.where("boardId").anyOf([...boardIds]).primaryKeys() as string[]) bookmarkIds.add(id);
    }
    await Promise.all([
      database.pages.bulkDelete(pageIds),
      database.boards.bulkDelete([...boardIds]),
      database.bookmarks.bulkDelete([...bookmarkIds]),
    ]);
    await repairWorkspaceInvariants(database);
    return pageIds.length + boardIds.size + bookmarkIds.size;
  });
}

export async function permanentlyDelete(
  type: "page" | "board" | "bookmark",
  id: string,
  database: AsterfoldDatabase = db,
): Promise<void> {
  await database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.settings], async () => {
    if (type === "bookmark") {
      const item = await database.bookmarks.get(id);
      if (!item) return;
      if (item.deletedAt === null) throw new ValidationError("Only Trash items can be permanently deleted");
      await database.bookmarks.delete(id);
      return;
    }
    if (type === "board") {
      const item = await database.boards.get(id);
      if (!item) return;
      if (item.deletedAt === null) throw new ValidationError("Only Trash items can be permanently deleted");
      await database.bookmarks.where("boardId").equals(id).delete();
      await database.boards.delete(id);
      await repairWorkspaceInvariants(database);
      return;
    }
    const item = await database.pages.get(id);
    if (!item) return;
    if (item.deletedAt === null) throw new ValidationError("Only Trash items can be permanently deleted");
    const boardIds = (await database.boards.where("pageId").equals(id).primaryKeys()) as string[];
    if (boardIds.length > 0) await database.bookmarks.where("boardId").anyOf(boardIds).delete();
    await database.boards.where("pageId").equals(id).delete();
    await database.pages.delete(id);
    await repairWorkspaceInvariants(database);
  });
}

export async function emptyTrash(database: AsterfoldDatabase = db): Promise<number> {
  return database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.settings], async () => {
    const trash = await listTrash(database);
    const count = trash.pages.length + trash.boards.length + trash.bookmarks.length;
    if (count === 0) return 0;
    await Promise.all([
      database.pages.bulkDelete(trash.pages.map((item) => item.id)),
      database.boards.bulkDelete(trash.boards.map((item) => item.id)),
      database.bookmarks.bulkDelete(trash.bookmarks.map((item) => item.id)),
    ]);
    await repairWorkspaceInvariants(database);
    return count;
  });
}


export async function saveWallpaper(
  file: Blob,
  name: string,
  database: AsterfoldDatabase = db,
): Promise<Wallpaper> {
  const processed = await processWallpaper(file);
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < processed.storedBytes * 1.25) {
    throw new PersistenceError("There is not enough local storage for this wallpaper");
  }
  const timestamp = nowIso();
  const wallpaper: Wallpaper = {
    id: createId(),
    kind: "upload",
    name: normalizeEntityTitle(name, "Custom wallpaper"),
    mimeType: processed.mimeType,
    blob: processed.blob,
    thumbnail: processed.thumbnail,
    value: null,
    width: processed.width,
    height: processed.height,
    sourceBytes: processed.sourceBytes,
    storedBytes: processed.storedBytes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.wallpapers.add(wallpaper);
  return wallpaper;
}

export async function getWallpaper(id: string, database: AsterfoldDatabase = db): Promise<Wallpaper | null> {
  return await database.wallpapers.get(id) ?? null;
}

export async function garbageCollectWallpapers(database: AsterfoldDatabase = db, activeId?: string | null): Promise<number> {
  const referencedId = activeId === undefined ? (await database.settings.get("app"))?.theme.wallpaperId ?? null : activeId;
  const orphanIds = (await database.wallpapers.filter((wallpaper) => wallpaper.kind === "upload" && wallpaper.id !== referencedId).primaryKeys()) as string[];
  if (orphanIds.length > 0) await database.wallpapers.bulkDelete(orphanIds);
  return orphanIds.length;
}

export async function auditInvariants(database: AsterfoldDatabase = db): Promise<string[]> {
  const [pages, boards, bookmarks, settings, wallpapers, snapshots] = await Promise.all([
    database.pages.toArray(),
    database.boards.toArray(),
    database.bookmarks.toArray(),
    database.settings.get("app"),
    database.wallpapers.toArray(),
    database.snapshots.toArray(),
  ]);
  const issues: string[] = [];
  const activePageIds = new Set(pages.filter((page) => page.deletedAt === null).map((page) => page.id));
  const activePagesList = pages.filter((page) => page.deletedAt === null);
  const activeBoardsList = boards.filter((board) => board.deletedAt === null);
  if (activePageIds.size === 0) issues.push("No active Page exists");
  if (activePagesList.filter((page) => page.isDefault).length !== 1) issues.push("Exactly one active default Page is required");
  for (const issue of validateScope(activePagesList)) issues.push(`Page ordering ${issue.code}: ${issue.id}`);
  for (const page of activePagesList) {
    for (const issue of validateScope(activeBoardsList.filter((board) => board.pageId === page.id))) {
      issues.push(`Board ordering ${issue.code}: ${issue.id}`);
    }
  }
  for (const board of activeBoardsList) {
    for (const issue of validateScope(bookmarks.filter((bookmark) => bookmark.deletedAt === null && bookmark.boardId === board.id))) {
      issues.push(`Bookmark ordering ${issue.code}: ${issue.id}`);
    }
  }
  if (settings?.activePageId && !activePageIds.has(settings.activePageId)) issues.push("Active Page setting points to a missing Page");
  for (const board of boards) {
    const parent = pages.find((page) => page.id === board.pageId);
    if (!parent) issues.push(`Board ${board.id} has no parent Page`);
    else if (board.deletedAt === null && parent.deletedAt !== null) issues.push(`Active Board ${board.id} has a deleted parent Page`);
  }
  for (const bookmark of bookmarks) {
    const parent = boards.find((board) => board.id === bookmark.boardId);
    if (!parent) issues.push(`Bookmark ${bookmark.id} has no parent Board`);
    else if (bookmark.deletedAt === null && parent.deletedAt !== null) issues.push(`Active Bookmark ${bookmark.id} has a deleted parent Board`);
    if (bookmark.deletedAt === null) {
      try {
        normalizeUrl(bookmark.url, false);
      } catch {
        issues.push(`Bookmark ${bookmark.id} contains an unsafe URL`);
      }
    }
  }
  const checkPair = (label: string, pageId: string | null | undefined, boardId: string | null | undefined): void => {
    if (!pageId || !activePageIds.has(pageId)) issues.push(`${label} Page points to a missing Page`);
    if (boardId) {
      const board = activeBoardsList.find((candidate) => candidate.id === boardId);
      if (!board || board.pageId !== pageId) issues.push(`${label} Board is missing or belongs to another Page`);
    }
  };
  if (settings) {
    if (!appSettingsSchema.safeParse(settings).success) issues.push("App settings do not match the current schema");
    checkPair("Quick Save default", settings.quickSaveDefaultPageId, settings.quickSaveDefaultBoardId);
    checkPair("Quick Save last", settings.quickSaveLastPageId, settings.quickSaveLastBoardId);
    const wallpaperId = settings.theme.wallpaperId;
    const builtinIds = new Set(["builtin-aurora", "builtin-mesh", "builtin-dusk"]);
    if (wallpaperId?.startsWith("builtin-") && !builtinIds.has(wallpaperId)) issues.push("Wallpaper setting points to an unknown builtin");
    if (wallpaperId && !wallpaperId.startsWith("builtin-") && !wallpapers.some((wallpaper) => wallpaper.id === wallpaperId)) {
      issues.push("Wallpaper setting points to a missing local asset");
    }
  } else {
    issues.push("App settings are missing");
  }
  for (const wallpaper of wallpapers) {
    const metadata = {
      id: wallpaper.id,
      kind: wallpaper.kind,
      name: wallpaper.name,
      mimeType: wallpaper.mimeType,
      value: wallpaper.value,
      createdAt: wallpaper.createdAt,
      updatedAt: wallpaper.updatedAt,
    };
    if (!wallpaperMetadataSchema.safeParse(metadata).success) issues.push(`Wallpaper ${wallpaper.id} has invalid metadata`);
    if (wallpaper.kind === "upload") {
      if (!wallpaper.blob || !wallpaper.thumbnail) issues.push(`Wallpaper ${wallpaper.id} is missing raster data`);
      if (!Number.isSafeInteger(wallpaper.width) || !Number.isSafeInteger(wallpaper.height)
        || (wallpaper.width ?? 0) < 1 || (wallpaper.height ?? 0) < 1
        || (wallpaper.width ?? 0) * (wallpaper.height ?? 0) > WALLPAPER_LIMITS.sourcePixels) {
        issues.push(`Wallpaper ${wallpaper.id} has invalid dimensions`);
      }
      if (!Number.isSafeInteger(wallpaper.storedBytes) || (wallpaper.storedBytes ?? 0) > WALLPAPER_LIMITS.aggregateBytes) {
        issues.push(`Wallpaper ${wallpaper.id} exceeds storage limits`);
      }
    }
  }
  for (const snapshot of snapshots) {
    if (!snapshotSchema.safeParse(snapshot).success) issues.push(`Snapshot ${snapshot.id} is invalid`);
  }
  return issues;
}

export async function resetDatabaseForTests(database: AsterfoldDatabase): Promise<void> {
  await database.transaction("rw", database.tables, async () => {
    await Promise.all(database.tables.map(async (table) => table.clear()));
  });
}

export { Dexie };
