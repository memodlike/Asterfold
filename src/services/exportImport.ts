import type { AsterfoldDatabase } from "../db/database";
import { version as packageVersion } from "../../package.json";
import { db } from "../db/database";
import { createSnapshot, ensureStarterWorkspace } from "../db/repository";
import { CURRENT_DB_SCHEMA_VERSION } from "../db/migrations";
import type { Board, Bookmark, Page, Wallpaper } from "../domain/models";
import { ImportError, ValidationError } from "../domain/errors";
import { allocateManyAtEnd, compareRanks } from "../domain/ordering";
import { backupSchema, type AsterfoldBackup } from "../domain/schemas";
import { normalizeUrl } from "../domain/urls";
import { createId, nowIso } from "../utils/ids";
import { inspectWallpaperSource } from "./wallpaper";

export const CURRENT_BACKUP_FORMAT_VERSION = 3;
export { backupSchema, type AsterfoldBackup } from "../domain/schemas";

export interface ImportRecord {
  title: string;
  url: string;
  description: string | null;
  folderPath: string[];
}

export interface ImportSummary {
  imported: number;
  skippedDuplicates: number;
  invalid: Array<{ row: number; reason: string }>;
}

export interface BackupImportPreview {
  valid: { pages: number; boards: number; bookmarks: number };
  invalid: number;
  skipped: number;
  conflicts: number;
  destructiveScope: "none" | "workspace";
  estimatedBytes: number;
}

function assertNoPrototypeKeys(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrototypeKeys(item);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) {
      throw new ImportError("The backup contains an unsafe object key");
    }
    assertNoPrototypeKeys(nested);
  }
}

async function encodeBlob(blob: Blob): Promise<string> {
  const buffer = typeof blob.arrayBuffer === "function"
    ? await blob.arrayBuffer()
    : blob instanceof Blob ? await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer), { once: true });
      reader.addEventListener("error", () => reject(new ImportError("Wallpaper data could not be read")), { once: true });
      reader.readAsArrayBuffer(blob);
    }) : await new Response(blob).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeBlob(value: string, mimeType: "image/webp"): Blob {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

async function serializeActiveWallpaper(settings: { theme: { wallpaperId: string | null } }, database: AsterfoldDatabase) {
  const wallpaperId = settings.theme.wallpaperId;
  if (!wallpaperId || wallpaperId.startsWith("builtin-")) return [];
  const wallpaper = await database.wallpapers.get(wallpaperId);
  if (!wallpaper || wallpaper.kind !== "upload" || wallpaper.mimeType !== "image/webp" || !wallpaper.blob || !wallpaper.thumbnail
    || !wallpaper.width || !wallpaper.height || !wallpaper.sourceBytes || !wallpaper.storedBytes) {
    throw new ImportError("The active uploaded wallpaper is unavailable for a complete backup");
  }
  const [data, thumbnail] = await Promise.all([encodeBlob(wallpaper.blob), encodeBlob(wallpaper.thumbnail)]);
  return [{
    id: wallpaper.id,
    name: wallpaper.name,
    kind: wallpaper.kind,
    mimeType: wallpaper.mimeType,
    width: wallpaper.width,
    height: wallpaper.height,
    sourceBytes: wallpaper.sourceBytes,
    storedBytes: wallpaper.storedBytes,
    data,
    thumbnail,
    createdAt: wallpaper.createdAt,
    updatedAt: wallpaper.updatedAt,
  }];
}

export async function createBackup(
  options: { pageId?: string; boardId?: string } = {},
  database: AsterfoldDatabase = db,
): Promise<AsterfoldBackup> {
  await ensureStarterWorkspace(database);
  const [allPages, allBoards, allBookmarks, settings] = await Promise.all([
    database.pages.toArray(),
    database.boards.toArray(),
    database.bookmarks.toArray(),
    database.settings.get("app"),
  ]);
  if (!settings) throw new ImportError("Settings are unavailable");

  let pages = allPages;
  let boards = allBoards;
  let bookmarks = allBookmarks;
  let scope: "full" | "page" | "board" = "full";
  if (options.boardId) {
    scope = "board";
    boards = allBoards.filter((board) => board.id === options.boardId);
    const pageIds = new Set(boards.map((board) => board.pageId));
    pages = allPages.filter((page) => pageIds.has(page.id));
    bookmarks = allBookmarks.filter((bookmark) => bookmark.boardId === options.boardId);
  } else if (options.pageId) {
    scope = "page";
    pages = allPages.filter((page) => page.id === options.pageId);
    const boardIds = new Set(allBoards.filter((board) => board.pageId === options.pageId).map((board) => board.id));
    boards = allBoards.filter((board) => boardIds.has(board.id));
    bookmarks = allBookmarks.filter((bookmark) => boardIds.has(bookmark.boardId));
  }
  const wallpapers = scope === "full" ? await serializeActiveWallpaper(settings, database) : [];
  return backupSchema.parse({
    schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
    exportVersion: CURRENT_BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    appVersion: packageVersion,
    scope,
    entities: { pages, boards, bookmarks },
    ...(scope === "full" ? { settings, theme: settings.theme } : {}),
    assets: { wallpapers },
  });
}

export async function createSelectionBackup(
  bookmarkIds: readonly string[],
  database: AsterfoldDatabase = db,
): Promise<AsterfoldBackup> {
  await ensureStarterWorkspace(database);
  const ids = [...new Set(bookmarkIds)];
  if (ids.length === 0) throw new ImportError("Select at least one bookmark to export");
  const bookmarks = await database.bookmarks.where("id").anyOf(ids).toArray();
  if (bookmarks.length !== ids.length) throw new ImportError("One or more selected bookmarks are unavailable");
  const boardIds = new Set(bookmarks.map((bookmark) => bookmark.boardId));
  const boards = await database.boards.where("id").anyOf([...boardIds]).toArray();
  if (boards.length !== boardIds.size) throw new ImportError("A selected bookmark has no parent Board");
  const pageIds = new Set(boards.map((board) => board.pageId));
  const pages = await database.pages.where("id").anyOf([...pageIds]).toArray();
  if (pages.length !== pageIds.size) throw new ImportError("A selected Board has no parent Page");
  return backupSchema.parse({
    schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
    exportVersion: CURRENT_BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    appVersion: packageVersion,
    scope: "selection",
    entities: { pages, boards, bookmarks },
    assets: { wallpapers: [] },
  });
}

export function serializeBackup(backup: AsterfoldBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text: string): AsterfoldBackup {
  if (new Blob([text]).size > 25 * 1024 * 1024) throw new ImportError("Backup must be 25 MB or smaller");
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new ImportError("The selected file is not valid JSON");
  }
  assertNoPrototypeKeys(raw);
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    throw new ImportError(`Backup validation failed: ${result.error.issues[0]?.message ?? "unknown schema error"}`);
  }
  for (const bookmark of result.data.entities.bookmarks) normalizeUrl(bookmark.url, false);
  const legacyTheme = result.data.exportVersion < 3 && result.data.settings?.theme.wallpaperId
    && !result.data.settings.theme.wallpaperId.startsWith("builtin-")
    ? { ...result.data.settings.theme, wallpaperId: null, backgroundMode: "auto" as const }
    : result.data.settings?.theme;
  return {
    ...result.data,
    ...(result.data.settings ? {
      settings: {
        ...result.data.settings,
        schemaVersion: CURRENT_DB_SCHEMA_VERSION,
        ...(legacyTheme ? { theme: legacyTheme } : {}),
      },
      ...(legacyTheme ? { theme: legacyTheme } : {}),
    } : {}),
  };
}

export function previewBackup(text: string, strategy: "merge" | "replace"): { backup: AsterfoldBackup; preview: BackupImportPreview } {
  const backup = parseBackup(text);
  return {
    backup,
    preview: {
      valid: {
        pages: backup.entities.pages.length,
        boards: backup.entities.boards.length,
        bookmarks: backup.entities.bookmarks.length,
      },
      invalid: 0,
      skipped: 0,
      conflicts: 0,
      destructiveScope: strategy === "replace" ? "workspace" : "none",
      estimatedBytes: new Blob([text]).size,
    },
  };
}

async function prepareWallpaperAssets(backup: AsterfoldBackup): Promise<Wallpaper[]> {
  if (backup.exportVersion !== 3) return [];
  return Promise.all((backup.assets?.wallpapers ?? []).map(async (asset) => {
    const blob = decodeBlob(asset.data, "image/webp");
    const thumbnail = decodeBlob(asset.thumbnail, "image/webp");
    const [imageInfo] = await Promise.all([
      inspectWallpaperSource(blob),
      inspectWallpaperSource(thumbnail),
    ]);
    if (imageInfo.width !== asset.width || imageInfo.height !== asset.height) {
      throw new ImportError("Wallpaper dimensions do not match the backup metadata");
    }
    if (blob.size + thumbnail.size !== asset.storedBytes) {
      throw new ImportError("Wallpaper size does not match the backup metadata");
    }
    return {
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      mimeType: asset.mimeType,
      blob,
      thumbnail,
      value: null,
      width: asset.width,
      height: asset.height,
      sourceBytes: asset.sourceBytes,
      storedBytes: asset.storedBytes,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }));
}

export async function restoreBackup(
  backup: AsterfoldBackup,
  strategy: "merge" | "replace",
  database: AsterfoldDatabase = db,
): Promise<void> {
  const validated = backupSchema.parse(backup);
  const wallpaperAssets = await prepareWallpaperAssets(validated);
  await database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.settings, database.wallpapers, database.snapshots], async () => {
    await createSnapshot(`before-${strategy}-restore`, database);
    if (strategy === "replace") {
      await Promise.all([database.bookmarks.clear(), database.boards.clear(), database.pages.clear()]);
      if (validated.exportVersion === 3) {
        await database.wallpapers.clear();
        if (wallpaperAssets.length > 0) await database.wallpapers.bulkPut(wallpaperAssets);
      }
    }
    const currentEntities = strategy === "merge"
      ? await Promise.all([database.pages.toArray(), database.boards.toArray(), database.bookmarks.toArray()])
      : [[], [], []];
    let currentPages = currentEntities[0];
    const currentBoards = currentEntities[1];
    const currentBookmarks = currentEntities[2];
    let incomingPages = validated.entities.pages as Page[];
    let incomingBoards = validated.entities.boards as Board[];
    let incomingBookmarks = validated.entities.bookmarks as Bookmark[];
    if (strategy === "merge") {
      const pageIds = new Map(incomingPages.map((page) => [page.id, createId()]));
      const boardIds = new Map(incomingBoards.map((board) => [board.id, createId()]));
      const deletedBatchIds = new Map(
        [...incomingPages, ...incomingBoards, ...incomingBookmarks]
          .map((entity) => entity.deletedBatchId)
          .filter((id): id is string => id !== null)
          .map((id) => [id, createId()]),
      );
      const pageAllocation = allocateManyAtEnd(currentPages, incomingPages.length);
      const previousPagePositions = new Map(currentPages.map((page) => [page.id, page.position]));
      const mergeTimestamp = nowIso();
      currentPages = pageAllocation.scope.map((page) => previousPagePositions.get(page.id) === page.position
        ? page
        : { ...page, updatedAt: mergeTimestamp, version: page.version + 1 });
      incomingPages = incomingPages.map((page, index) => ({
        ...page,
        id: pageIds.get(page.id)!,
        position: pageAllocation.positions[index]!,
        isDefault: false,
        deletedBatchId: page.deletedBatchId ? deletedBatchIds.get(page.deletedBatchId)! : null,
      }));
      incomingBoards = incomingBoards.map((board) => ({
        ...board,
        id: boardIds.get(board.id)!,
        pageId: pageIds.get(board.pageId)!,
        deletedBatchId: board.deletedBatchId ? deletedBatchIds.get(board.deletedBatchId)! : null,
      }));
      incomingBookmarks = incomingBookmarks.map((bookmark) => ({
        ...bookmark,
        id: createId(),
        boardId: boardIds.get(bookmark.boardId)!,
        deletedBatchId: bookmark.deletedBatchId ? deletedBatchIds.get(bookmark.deletedBatchId)! : null,
      }));
    }
    await database.pages.bulkPut([...currentPages, ...incomingPages]);
    await database.boards.bulkPut([...currentBoards, ...incomingBoards]);
    await database.bookmarks.bulkPut([...currentBookmarks, ...incomingBookmarks]);
    if (validated.settings && strategy === "replace") await database.settings.put(validated.settings);
  });
  await ensureStarterWorkspace(database);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function toNetscapeHtml(backup: AsterfoldBackup): string {
  const boardsByPage = new Map<string, Board[]>();
  const bookmarksByBoard = new Map<string, Bookmark[]>();
  for (const board of backup.entities.boards.filter((item) => item.deletedAt === null)) {
    boardsByPage.set(board.pageId, [...(boardsByPage.get(board.pageId) ?? []), board as Board]);
  }
  for (const bookmark of backup.entities.bookmarks.filter((item) => item.deletedAt === null)) {
    bookmarksByBoard.set(bookmark.boardId, [...(bookmarksByBoard.get(bookmark.boardId) ?? []), bookmark as Bookmark]);
  }
  const lines = ["<!DOCTYPE NETSCAPE-Bookmark-file-1>", "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">", "<TITLE>Asterfold Bookmarks</TITLE>", "<H1>Asterfold Bookmarks</H1>", "<DL><p>"];
  for (const page of backup.entities.pages.filter((item) => item.deletedAt === null)) {
    lines.push(`  <DT><H3>${escapeHtml(page.title)}</H3>`, "  <DL><p>");
    for (const board of (boardsByPage.get(page.id) ?? []).sort((a, b) => a.position.localeCompare(b.position))) {
      lines.push(`    <DT><H3>${escapeHtml(board.title)}</H3>`, "    <DL><p>");
      for (const bookmark of (bookmarksByBoard.get(board.id) ?? []).sort((a, b) => a.position.localeCompare(b.position))) {
        lines.push(`      <DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${Math.floor(new Date(bookmark.createdAt).getTime() / 1000)}">${escapeHtml(bookmark.title)}</A>`);
        if (bookmark.description) lines.push(`      <DD>${escapeHtml(bookmark.description)}`);
      }
      lines.push("    </DL><p>");
    }
    lines.push("  </DL><p>");
  }
  lines.push("</DL><p>");
  return lines.join("\n");
}

export function toMarkdown(backup: AsterfoldBackup): string {
  const text = (value: string): string => value
    .replace(/\r?\n|\r/gu, " ")
    .replace(/([\\#*_`[\]()<>])/gu, "\\$1");
  const destination = (value: string): string => value
    .replace(/\r?\n|\r/gu, "")
    .replace(/([\\()])/gu, "\\$1");
  const output = ["# Asterfold bookmarks", ""];
  for (const page of backup.entities.pages.filter((item) => item.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position))) {
    output.push(`## ${text(page.title)}`, "");
    for (const board of backup.entities.boards.filter((item) => item.pageId === page.id && item.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position))) {
      output.push(`### ${text(board.title)}`, "");
      for (const bookmark of backup.entities.bookmarks.filter((item) => item.boardId === board.id && item.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position))) {
        output.push(`- [${text(bookmark.title)}](${destination(bookmark.url)})${bookmark.description ? ` — ${text(bookmark.description)}` : ""}`);
      }
      output.push("");
    }
  }
  return output.join("\n");
}

export function downloadText(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function parseNetscapeHtml(text: string): ImportRecord[] {
  if (new Blob([text]).size > 25 * 1024 * 1024) throw new ImportError("Bookmark file must be 25 MB or smaller");
  const records: ImportRecord[] = [];
  const folders: string[] = [];
  let pendingFolder: string | null = null;
  let capture: "folder" | "anchor" | "description" | null = null;
  let buffer = "";
  let href = "";
  let lastRecord: ImportRecord | undefined;
  const decode = (value: string): string => value
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&quot;", "\"").replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
  for (const match of text.matchAll(/<\/?(?:dl|h3|a|dd)\b[^>]*>|[^<]+/giu)) {
    const token = match[0];
    if (!token.startsWith("<")) {
      if (capture) buffer += token;
      continue;
    }
    const closing = token.startsWith("</");
    const tag = /^<\/?([a-z0-9]+)/iu.exec(token)?.[1]?.toLowerCase();
    if (tag === "h3" && !closing) { capture = "folder"; buffer = ""; }
    else if (tag === "h3" && closing && capture === "folder") { pendingFolder = decode(buffer).trim().slice(0, 240) || null; capture = null; }
    else if (tag === "dl" && !closing) {
      if (pendingFolder) folders.push(pendingFolder);
      pendingFolder = null;
      if (folders.length > 100) throw new ImportError("Bookmark folder nesting is too deep");
    } else if (tag === "dl" && closing) { folders.pop(); }
    else if (tag === "a" && !closing) {
      href = decode(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(token)?.slice(1).find(Boolean) ?? "");
      capture = "anchor"; buffer = "";
    } else if (tag === "a" && closing && capture === "anchor") {
      try {
        const normalized = normalizeUrl(href, false);
        lastRecord = { title: decode(buffer).trim().slice(0, 240) || normalized.hostname, url: normalized.url, description: null, folderPath: [...folders] };
        records.push(lastRecord);
      } catch { lastRecord = undefined; }
      capture = null;
    } else if (tag === "dd" && !closing) { capture = "description"; buffer = ""; }
    else if (tag === "dd" && closing && capture === "description") {
      if (lastRecord) lastRecord.description = decode(buffer).trim().slice(0, 2_000) || null;
      capture = null;
    }
  }
  return records;
}

export async function importRecords(
  records: ImportRecord[],
  destination: { pageTitle: string; pageId?: string },
  duplicateStrategy: "skip" | "allow",
  database: AsterfoldDatabase = db,
): Promise<ImportSummary> {
  await ensureStarterWorkspace(database);
  const valid: Array<ImportRecord & { normalizedUrl: string; hostname: string }> = [];
  const invalid: ImportSummary["invalid"] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    try {
      const normalized = normalizeUrl(record.url);
      valid.push({ ...record, normalizedUrl: normalized.normalizedUrl, hostname: normalized.hostname });
    } catch (error) {
      invalid.push({ row: index + 1, reason: error instanceof Error ? error.message : "Invalid URL" });
    }
  }
  if (valid.length === 0 && records.length > 0) throw new ImportError("No valid bookmarks were found");
  return database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.settings, database.wallpapers, database.snapshots], async () => {
    await createSnapshot("before-bookmark-import", database);
    let pageId = destination.pageId;
    if (pageId) {
      const page = await database.pages.get(pageId);
      if (!page || page.deletedAt !== null) throw new ValidationError("Import destination Page not found");
    } else {
      const existingPages = (await database.pages.toArray()).filter((page) => page.deletedAt === null).sort((a, b) => compareRanks(a.position, b.position));
      pageId = createId();
      const timestamp = nowIso();
      const allocation = allocateManyAtEnd(existingPages, 1);
      const previousPositions = new Map(existingPages.map((page) => [page.id, page.position]));
      const rebalancedPages = allocation.scope
        .filter((page) => previousPositions.get(page.id) !== page.position)
        .map((page) => ({ ...page, updatedAt: timestamp, version: page.version + 1 }));
      if (rebalancedPages.length > 0) await database.pages.bulkPut(rebalancedPages);
      await database.pages.add({
        id: pageId,
        userId: null,
        title: destination.pageTitle.trim() || "Imported",
        icon: "download",
        accent: null,
        position: allocation.positions[0]!,
        isDefault: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        deletedBatchId: null,
        version: 1,
      });
    }

    const folderGroups = new Map<string, typeof valid>();
    for (const record of valid) {
      const folder = record.folderPath.at(-1) || "Imported bookmarks";
      const group = folderGroups.get(folder);
      if (group) group.push(record);
      else folderGroups.set(folder, [record]);
    }
    const existingBoards = (await database.boards.where("pageId").equals(pageId).toArray())
      .filter((board) => board.deletedAt === null)
      .sort((left, right) => compareRanks(left.position, right.position));
    const missingBoardTitles = [...folderGroups.keys()]
      .map((title) => title.slice(0, 240))
      .filter((title, index, titles) => !existingBoards.some((board) => board.title === title) && titles.indexOf(title) === index);
    const boardAllocation = allocateManyAtEnd(existingBoards, missingBoardTitles.length);
    const previousBoardPositions = new Map(existingBoards.map((board) => [board.id, board.position]));
    const boardTimestamp = nowIso();
    const rebalancedBoards = boardAllocation.scope
      .filter((board) => previousBoardPositions.get(board.id) !== board.position)
      .map((board) => ({ ...board, updatedAt: boardTimestamp, version: board.version + 1 }));
    if (rebalancedBoards.length > 0) await database.boards.bulkPut(rebalancedBoards);
    const newBoards = missingBoardTitles.map((title, index): Board => ({
      id: createId(), userId: null, pageId, title, icon: "folder", accent: null,
      position: boardAllocation.positions[index]!, collapsed: false, layout: "list",
      bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3,
      createdAt: boardTimestamp, updatedAt: boardTimestamp, deletedAt: null, deletedBatchId: null, version: 1,
    }));
    if (newBoards.length > 0) await database.boards.bulkAdd(newBoards);
    existingBoards.splice(0, existingBoards.length, ...boardAllocation.scope, ...newBoards);
    let imported = 0;
    let skippedDuplicates = 0;
    for (const [folderTitle, group] of folderGroups) {
      const board = existingBoards.find((candidate) => candidate.title === folderTitle.slice(0, 240));
      if (!board) throw new ImportError("Import destination Board could not be allocated");
      const current = (await database.bookmarks.where("boardId").equals(board.id).toArray()).filter((bookmark) => bookmark.deletedAt === null);
      const known = new Set(current.map((bookmark) => bookmark.normalizedUrl));
      const accepted = group.filter((record) => {
        if (duplicateStrategy === "skip" && known.has(record.normalizedUrl)) {
          skippedDuplicates += 1;
          return false;
        }
        known.add(record.normalizedUrl);
        return true;
      });
      const timestamp = nowIso();
      const allocation = allocateManyAtEnd(current, accepted.length);
      const previousPositions = new Map(current.map((bookmark) => [bookmark.id, bookmark.position]));
      const rebalancedBookmarks = allocation.scope
        .filter((bookmark) => previousPositions.get(bookmark.id) !== bookmark.position)
        .map((bookmark) => ({ ...bookmark, updatedAt: timestamp, version: bookmark.version + 1 }));
      if (rebalancedBookmarks.length > 0) await database.bookmarks.bulkPut(rebalancedBookmarks);
      if (accepted.length > 0) {
        await database.bookmarks.bulkAdd(accepted.map((record, index) => ({
          id: createId(), userId: null, boardId: board.id, title: record.title.slice(0, 240), url: record.url,
          normalizedUrl: record.normalizedUrl, hostname: record.hostname, description: record.description?.slice(0, 2000) ?? null,
          faviconUrl: null, customIcon: null, position: allocation.positions[index]!, openMode: "current" as const, pinned: false,
          createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1,
        })));
      }
      imported += accepted.length;
    }
    return { imported, skippedDuplicates, invalid };
  });
}
