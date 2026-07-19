import Dexie from "dexie";
import type {
  AppSettings,
  Board,
  Bookmark,
  BookmarkPatch,
  NewBookmarkInput,
  Page,
  Snapshot,
  Wallpaper,
  WorkspaceData,
} from "../domain/models";
import { DuplicateError, PersistenceError, ValidationError } from "../domain/errors";
import { compareRanks, evenlySpacedRanks, rankBetween } from "../domain/ordering";
import { normalizeUrl } from "../domain/urls";
import { validateTheme } from "../domain/themes";
import { createId, nowIso } from "../utils/ids";
import { createDefaultSettings } from "./defaults";
import { db, type AsterfoldDatabase } from "./database";

const MAX_TITLE_LENGTH = 240;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_SNAPSHOTS = 10;

function cleanTitle(value: string, fallback: string): string {
  const title = value.trim() || fallback;
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return title;
}

function cleanDescription(value: string | null | undefined): string | null {
  const description = value?.trim() ?? "";
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  }
  return description.length === 0 ? null : description;
}

function sortByPosition<T extends { position: string }>(items: T[]): T[] {
  return items.sort((left, right) => compareRanks(left.position, right.position));
}

function hashPayload(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
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

async function lastRank<T extends { position: string }>(items: Promise<T[]>): Promise<string | null> {
  const resolved = await items;
  return resolved.at(-1)?.position ?? null;
}

async function captureSnapshotPayload(database: AsterfoldDatabase): Promise<unknown> {
  const [pages, boards, bookmarks, settings, wallpapers] = await Promise.all([
    database.pages.toArray(),
    database.boards.toArray(),
    database.bookmarks.toArray(),
    database.settings.toArray(),
    database.wallpapers.toArray(),
  ]);
  return { schemaVersion: 1, pages, boards, bookmarks, settings, wallpapers };
}

async function addSnapshot(database: AsterfoldDatabase, reason: string): Promise<Snapshot> {
  const payload = await captureSnapshotPayload(database);
  const snapshot: Snapshot = {
    id: createId(),
    schemaVersion: 1,
    createdAt: nowIso(),
    reason,
    checksum: hashPayload(payload),
    payload,
  };
  await database.snapshots.add(snapshot);
  const snapshots = await database.snapshots.orderBy("createdAt").toArray();
  const overflow = snapshots.slice(0, Math.max(0, snapshots.length - MAX_SNAPSHOTS));
  if (overflow.length > 0) await database.snapshots.bulkDelete(overflow.map((item) => item.id));
  return snapshot;
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
  const current = await database.settings.get("app");
  if (!current) throw new PersistenceError("Application settings are unavailable");
  const next: AppSettings = {
    ...current,
    ...patch,
    theme: patch.theme ? validateTheme(patch.theme) : current.theme,
    id: "app",
    schemaVersion: current.schemaVersion,
    updatedAt: nowIso(),
  };
  await database.settings.put(next);
  return next;
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
    const position = rankBetween(pages.at(-1)?.position ?? null, null);
    if (!position) throw new PersistenceError("Page positions require rebalancing");
    const page: Page = {
      id: createId(),
      userId: null,
      title: cleanTitle(title, "Untitled page"),
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
      await database.pages.filter((candidate) => candidate.isDefault).modify({ isDefault: false });
    }
    await database.pages.add(page);
    await database.settings.update("app", { activePageId: page.id, updatedAt: timestamp });
    return page;
  });
}

export async function renamePage(id: string, title: string, database: AsterfoldDatabase = db): Promise<void> {
  const page = await database.pages.get(id);
  if (!page || page.deletedAt !== null) throw new ValidationError("Page not found");
  await database.pages.update(id, { title: cleanTitle(title, page.title), updatedAt: nowIso(), version: page.version + 1 });
}

export async function setDefaultPage(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.pages, database.settings, async () => {
    const page = await database.pages.get(id);
    if (!page || page.deletedAt !== null) throw new ValidationError("Page not found");
    await database.pages.filter((candidate) => candidate.isDefault).modify({ isDefault: false });
    await database.pages.update(id, { isDefault: true, updatedAt: nowIso(), version: page.version + 1 });
    await database.settings.update("app", { quickSaveDefaultPageId: id, updatedAt: nowIso() });
  });
}

export async function movePageToIndex(id: string, targetIndex: number, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.pages, async () => {
    const pages = (await activePages(database)).filter((page) => page.id !== id);
    const index = Math.max(0, Math.min(targetIndex, pages.length));
    const previous = pages[index - 1]?.position ?? null;
    const next = pages[index]?.position ?? null;
    const position = rankBetween(previous, next);
    const current = await database.pages.get(id);
    if (!current || current.deletedAt !== null) throw new ValidationError("Page not found");
    if (position) {
      await database.pages.update(id, { position, updatedAt: nowIso(), version: current.version + 1 });
      return;
    }
    pages.splice(index, 0, current);
    const ranks = evenlySpacedRanks(pages.length);
    await database.pages.bulkPut(pages.map((page, pageIndex) => ({ ...page, position: ranks[pageIndex] ?? page.position, updatedAt: nowIso(), version: page.version + 1 })));
  });
}

export async function duplicatePage(id: string, database: AsterfoldDatabase = db): Promise<Page> {
  await ensureStarterWorkspace(database);
  return database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    const source = await database.pages.get(id);
    if (!source || source.deletedAt !== null) throw new ValidationError("Page not found");
    const timestamp = nowIso();
    const pageId = createId();
    const page: Page = {
      ...source,
      id: pageId,
      title: cleanTitle(`${source.title} copy`, source.title),
      position: rankBetween(await lastRank(activePages(database)), null) ?? evenlySpacedRanks(2)[1]!,
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
    if (settings?.activePageId === id || page.isDefault) {
      await database.settings.update("app", {
        activePageId: next?.id ?? null,
        quickSaveDefaultPageId: page.isDefault ? next?.id ?? null : settings?.quickSaveDefaultPageId ?? null,
        updatedAt: timestamp,
      });
      if (page.isDefault && next) await database.pages.update(next.id, { isDefault: true });
    }
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
    await database.pages.update(id, { deletedAt: null, deletedBatchId: null, updatedAt: timestamp, version: page.version + 1 });
    if (batchId) {
      await database.boards.where("pageId").equals(id).filter((board) => board.deletedBatchId === batchId).modify((board) => {
        board.deletedAt = null;
        board.deletedBatchId = null;
        board.updatedAt = timestamp;
        board.version += 1;
      });
      await database.bookmarks.filter((bookmark) => bookmark.deletedBatchId === batchId).modify((bookmark) => {
        bookmark.deletedAt = null;
        bookmark.deletedBatchId = null;
        bookmark.updatedAt = timestamp;
        bookmark.version += 1;
      });
    }
    await database.settings.update("app", { activePageId: id, updatedAt: timestamp });
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
    const position = rankBetween(boards.at(-1)?.position ?? null, null);
    if (!position) throw new PersistenceError("Board positions require rebalancing");
    const board: Board = {
      id: createId(),
      userId: null,
      pageId,
      title: cleanTitle(title, "Untitled board"),
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
    title: patch.title === undefined ? board.title : cleanTitle(patch.title, board.title),
    gridColumn: patch.gridColumn === undefined ? board.gridColumn : Math.min(12, Math.max(1, Math.round(patch.gridColumn))),
    gridRow: patch.gridRow === undefined ? board.gridRow : patch.gridRow === 1 ? 1 : 0,
    gridSpan: patch.gridSpan === undefined ? board.gridSpan : Math.min(6, Math.max(2, Math.round(patch.gridSpan))),
    updatedAt: nowIso(),
    version: board.version + 1,
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
    const boards = (await activeBoards(database, targetPageId)).filter((board) => board.id !== id);
    const index = Math.max(0, Math.min(targetIndex, boards.length));
    const position = rankBetween(boards[index - 1]?.position ?? null, boards[index]?.position ?? null);
    if (position) {
      await database.boards.update(id, { pageId: targetPageId, position, updatedAt: nowIso(), version: current.version + 1 });
      return;
    }
    const moved = { ...current, pageId: targetPageId };
    boards.splice(index, 0, moved);
    const ranks = evenlySpacedRanks(boards.length);
    await database.boards.bulkPut(boards.map((board, boardIndex) => ({ ...board, position: ranks[boardIndex] ?? board.position, updatedAt: nowIso(), version: board.version + 1 })));
  });
}

export async function duplicateBoard(id: string, database: AsterfoldDatabase = db): Promise<Board> {
  return database.transaction("rw", database.boards, database.bookmarks, async () => {
    const source = await database.boards.get(id);
    if (!source || source.deletedAt !== null) throw new ValidationError("Board not found");
    const siblings = await activeBoards(database, source.pageId);
    const timestamp = nowIso();
    const copy: Board = {
      ...source,
      id: createId(),
      title: cleanTitle(`${source.title} copy`, source.title),
      position: rankBetween(siblings.at(-1)?.position ?? null, null) ?? evenlySpacedRanks(siblings.length + 1).at(-1)!,
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
  return database.transaction("rw", database.boards, database.bookmarks, async () => {
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
    return batchId;
  });
}

export async function restoreBoard(id: string, database: AsterfoldDatabase = db): Promise<void> {
  await database.transaction("rw", database.pages, database.boards, database.bookmarks, async () => {
    const board = await database.boards.get(id);
    if (!board || board.deletedAt === null) throw new ValidationError("Deleted board not found");
    const parent = await database.pages.get(board.pageId);
    if (!parent || parent.deletedAt !== null) throw new ValidationError("Restore the parent page first");
    const timestamp = nowIso();
    const batchId = board.deletedBatchId;
    await database.boards.update(id, { deletedAt: null, deletedBatchId: null, updatedAt: timestamp, version: board.version + 1 });
    if (batchId) {
      await database.bookmarks.where("boardId").equals(id).filter((bookmark) => bookmark.deletedBatchId === batchId).modify((bookmark) => {
        bookmark.deletedAt = null;
        bookmark.deletedBatchId = null;
        bookmark.updatedAt = timestamp;
        bookmark.version += 1;
      });
    }
  });
}

export async function findDuplicate(
  boardId: string,
  url: string,
  database: AsterfoldDatabase = db,
): Promise<Bookmark | null> {
  const normalized = normalizeUrl(url).normalizedUrl;
  const match = await database.bookmarks
    .where("normalizedUrl")
    .equals(normalized)
    .filter((bookmark) => bookmark.boardId === boardId && bookmark.deletedAt === null)
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
        .where("normalizedUrl")
        .equals(normalized.normalizedUrl)
        .filter((bookmark) => bookmark.boardId === input.boardId && bookmark.deletedAt === null)
        .first();
      if (duplicate) throw new DuplicateError("This bookmark already exists in the selected board", duplicate.id);
    }
    const siblings = await activeBookmarks(database, input.boardId);
    const position = rankBetween(siblings.at(-1)?.position ?? null, null);
    if (!position) throw new PersistenceError("Bookmark positions require rebalancing");
    const timestamp = nowIso();
    const bookmark: Bookmark = {
      id: createId(),
      userId: null,
      boardId: input.boardId,
      title: cleanTitle(input.title, normalized.hostname || "Untitled bookmark"),
      url: normalized.url,
      normalizedUrl: normalized.normalizedUrl,
      hostname: normalized.hostname,
      description: cleanDescription(input.description),
      faviconUrl: input.faviconUrl ?? null,
      customIcon: null,
      position,
      openMode: input.openMode ?? "new-tab",
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
    const updated: Bookmark = {
      ...current,
      ...patch,
      boardId: targetBoardId,
      title: patch.title === undefined ? current.title : cleanTitle(patch.title, current.title),
      description: patch.description === undefined ? current.description : cleanDescription(patch.description),
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
    const items = (await activeBookmarks(database, targetBoardId)).filter((bookmark) => bookmark.id !== id);
    const index = Math.max(0, Math.min(targetIndex, items.length));
    const position = rankBetween(items[index - 1]?.position ?? null, items[index]?.position ?? null);
    if (position) {
      await database.bookmarks.update(id, { boardId: targetBoardId, position, updatedAt: nowIso(), version: current.version + 1 });
      return;
    }
    const moved = { ...current, boardId: targetBoardId };
    items.splice(index, 0, moved);
    const ranks = evenlySpacedRanks(items.length);
    await database.bookmarks.bulkPut(items.map((bookmark, bookmarkIndex) => ({ ...bookmark, position: ranks[bookmarkIndex] ?? bookmark.position, updatedAt: nowIso(), version: bookmark.version + 1 })));
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
    faviconUrl: source.faviconUrl,
    openMode: source.openMode,
    pinned: source.pinned,
  }, { allowDuplicate: true }, database);
}

export async function softDeleteBookmark(id: string, database: AsterfoldDatabase = db): Promise<void> {
  const bookmark = await database.bookmarks.get(id);
  if (!bookmark || bookmark.deletedAt !== null) throw new ValidationError("Bookmark not found");
  const timestamp = nowIso();
  await database.bookmarks.update(id, { deletedAt: timestamp, deletedBatchId: createId(), updatedAt: timestamp, version: bookmark.version + 1 });
}

export async function restoreBookmark(id: string, database: AsterfoldDatabase = db): Promise<void> {
  const bookmark = await database.bookmarks.get(id);
  if (!bookmark || bookmark.deletedAt === null) throw new ValidationError("Deleted bookmark not found");
  const board = await database.boards.get(bookmark.boardId);
  if (!board || board.deletedAt !== null) throw new ValidationError("Restore the parent board first");
  await database.bookmarks.update(id, { deletedAt: null, deletedBatchId: null, updatedAt: nowIso(), version: bookmark.version + 1 });
}

export async function bulkMoveBookmarks(ids: string[], boardId: string, database: AsterfoldDatabase = db): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  for (let index = 0; index < uniqueIds.length; index += 1) {
    await moveBookmarkToIndex(uniqueIds[index]!, boardId, Number.MAX_SAFE_INTEGER, database);
  }
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
  return database.transaction("rw", database.pages, database.boards, database.bookmarks, async () => {
    const pageIds = (await database.pages.filter((item) => item.deletedAt !== null && item.deletedAt < cutoff).primaryKeys()) as string[];
    const boardIds = (await database.boards.filter((item) => item.deletedAt !== null && item.deletedAt < cutoff).primaryKeys()) as string[];
    const bookmarkIds = (await database.bookmarks.filter((item) => item.deletedAt !== null && item.deletedAt < cutoff).primaryKeys()) as string[];
    await Promise.all([
      database.pages.bulkDelete(pageIds),
      database.boards.bulkDelete(boardIds),
      database.bookmarks.bulkDelete(bookmarkIds),
    ]);
    return pageIds.length + boardIds.length + bookmarkIds.length;
  });
}

export async function permanentlyDelete(
  type: "page" | "board" | "bookmark",
  id: string,
  database: AsterfoldDatabase = db,
): Promise<void> {
  await database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.snapshots, database.settings, database.wallpapers], async () => {
    await addSnapshot(database, `permanent-delete-${type}`);
    if (type === "bookmark") {
      const item = await database.bookmarks.get(id);
      if (!item || item.deletedAt === null) throw new ValidationError("Only Trash items can be permanently deleted");
      await database.bookmarks.delete(id);
      return;
    }
    if (type === "board") {
      const item = await database.boards.get(id);
      if (!item || item.deletedAt === null) throw new ValidationError("Only Trash items can be permanently deleted");
      await database.bookmarks.where("boardId").equals(id).delete();
      await database.boards.delete(id);
      return;
    }
    const item = await database.pages.get(id);
    if (!item || item.deletedAt === null) throw new ValidationError("Only Trash items can be permanently deleted");
    const boardIds = (await database.boards.where("pageId").equals(id).primaryKeys()) as string[];
    if (boardIds.length > 0) await database.bookmarks.where("boardId").anyOf(boardIds).delete();
    await database.boards.where("pageId").equals(id).delete();
    await database.pages.delete(id);
  });
}

export async function emptyTrash(database: AsterfoldDatabase = db): Promise<number> {
  return database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.snapshots, database.settings, database.wallpapers], async () => {
    await addSnapshot(database, "empty-trash");
    const trash = await listTrash(database);
    const count = trash.pages.length + trash.boards.length + trash.bookmarks.length;
    await Promise.all([
      database.pages.bulkDelete(trash.pages.map((item) => item.id)),
      database.boards.bulkDelete(trash.boards.map((item) => item.id)),
      database.bookmarks.bulkDelete(trash.bookmarks.map((item) => item.id)),
    ]);
    return count;
  });
}

export async function createSnapshot(reason: string, database: AsterfoldDatabase = db): Promise<Snapshot> {
  return database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.settings, database.wallpapers, database.snapshots], async () => addSnapshot(database, reason));
}

export async function saveWallpaper(
  file: Blob,
  name: string,
  database: AsterfoldDatabase = db,
): Promise<Wallpaper> {
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);
  if (!allowed.has(file.type)) throw new ValidationError("Use a PNG, JPEG, WebP, or AVIF image");
  if (file.size > 10 * 1024 * 1024) throw new ValidationError("Wallpaper must be 10 MB or smaller");
  const timestamp = nowIso();
  const wallpaper: Wallpaper = {
    id: createId(),
    kind: "upload",
    name: cleanTitle(name, "Custom wallpaper"),
    mimeType: file.type,
    blob: file,
    thumbnail: null,
    value: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.wallpapers.add(wallpaper);
  return wallpaper;
}

export async function auditInvariants(database: AsterfoldDatabase = db): Promise<string[]> {
  const [pages, boards, bookmarks, settings] = await Promise.all([
    database.pages.toArray(),
    database.boards.toArray(),
    database.bookmarks.toArray(),
    database.settings.get("app"),
  ]);
  const issues: string[] = [];
  const activePageIds = new Set(pages.filter((page) => page.deletedAt === null).map((page) => page.id));
  const activeBoardIds = new Set(boards.filter((board) => board.deletedAt === null).map((board) => board.id));
  if (activePageIds.size === 0) issues.push("No active Page exists");
  if (settings?.activePageId && !activePageIds.has(settings.activePageId)) issues.push("Active Page setting points to a missing Page");
  for (const board of boards.filter((item) => item.deletedAt === null)) {
    if (!activePageIds.has(board.pageId)) issues.push(`Board ${board.id} has no active parent Page`);
  }
  for (const bookmark of bookmarks.filter((item) => item.deletedAt === null)) {
    if (!activeBoardIds.has(bookmark.boardId)) issues.push(`Bookmark ${bookmark.id} has no active parent Board`);
    try {
      normalizeUrl(bookmark.url, false);
    } catch {
      issues.push(`Bookmark ${bookmark.id} contains an unsafe URL`);
    }
  }
  return issues;
}

export async function resetDatabaseForTests(database: AsterfoldDatabase): Promise<void> {
  await database.transaction("rw", database.tables, async () => {
    await Promise.all(database.tables.map(async (table) => table.clear()));
  });
}

export { Dexie };
