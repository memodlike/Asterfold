import type { AsterfoldDatabase } from "../db/database";
import { db } from "../db/database";
import { createSnapshot, ensureStarterWorkspace } from "../db/repository";
import { CURRENT_DB_SCHEMA_VERSION } from "../db/migrations";
import type { Board, Bookmark, Page } from "../domain/models";
import { ImportError, ValidationError } from "../domain/errors";
import { evenlySpacedRanks } from "../domain/ordering";
import { backupSchema, type AsterfoldBackup } from "../domain/schemas";
import { normalizeUrl } from "../domain/urls";
import { createId, nowIso } from "../utils/ids";

export const CURRENT_BACKUP_FORMAT_VERSION = 2;
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
  return backupSchema.parse({
    schemaVersion: 2,
    exportVersion: 2,
    exportedAt: nowIso(),
    appVersion: "2.1.3",
    scope,
    entities: { pages, boards, bookmarks },
    ...(scope === "full" ? { settings, theme: settings.theme } : {}),
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
  const migrated = result.data.exportVersion === 1
    ? migrateBackupV1ToV2(result.data)
    : result.data;
  return {
    ...migrated,
    ...(migrated.settings ? { settings: { ...migrated.settings, schemaVersion: CURRENT_DB_SCHEMA_VERSION } } : {}),
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

function migrateBackupV1ToV2(backup: AsterfoldBackup): AsterfoldBackup {
  return {
    ...backup,
    schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
    exportVersion: CURRENT_BACKUP_FORMAT_VERSION,
  };
}

export async function restoreBackup(
  backup: AsterfoldBackup,
  strategy: "merge" | "replace",
  database: AsterfoldDatabase = db,
): Promise<void> {
  backupSchema.parse(backup);
  await database.transaction("rw", [database.pages, database.boards, database.bookmarks, database.settings, database.wallpapers, database.snapshots], async () => {
    await createSnapshot(`before-${strategy}-restore`, database);
    if (strategy === "replace") {
      await Promise.all([database.bookmarks.clear(), database.boards.clear(), database.pages.clear()]);
    }
    const [currentPages, currentBoards, currentBookmarks] = strategy === "merge"
      ? await Promise.all([database.pages.toArray(), database.boards.toArray(), database.bookmarks.toArray()])
      : [[], [], []];
    let incomingPages = backup.entities.pages as Page[];
    let incomingBoards = backup.entities.boards as Board[];
    let incomingBookmarks = backup.entities.bookmarks as Bookmark[];
    if (strategy === "merge") {
      const pageIds = new Map(incomingPages.map((page) => [page.id, createId()]));
      const boardIds = new Map(incomingBoards.map((board) => [board.id, createId()]));
      const pageRanks = evenlySpacedRanks(currentPages.length + incomingPages.length).slice(currentPages.length);
      incomingPages = incomingPages.map((page, index) => ({
        ...page,
        id: pageIds.get(page.id)!,
        position: pageRanks[index]!,
        isDefault: false,
      }));
      incomingBoards = incomingBoards.map((board) => ({
        ...board,
        id: boardIds.get(board.id)!,
        pageId: pageIds.get(board.pageId)!,
      }));
      incomingBookmarks = incomingBookmarks.map((bookmark) => ({
        ...bookmark,
        id: createId(),
        boardId: boardIds.get(bookmark.boardId)!,
      }));
    }
    await database.pages.bulkPut([...currentPages, ...incomingPages]);
    await database.boards.bulkPut([...currentBoards, ...incomingBoards]);
    await database.bookmarks.bulkPut([...currentBookmarks, ...incomingBookmarks]);
    if (backup.settings && strategy === "replace") await database.settings.put(backup.settings);
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
  const output = ["# Asterfold bookmarks", ""];
  for (const page of backup.entities.pages.filter((item) => item.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position))) {
    output.push(`## ${page.title}`, "");
    for (const board of backup.entities.boards.filter((item) => item.pageId === page.id && item.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position))) {
      output.push(`### ${board.title}`, "");
      for (const bookmark of backup.entities.bookmarks.filter((item) => item.boardId === board.id && item.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position))) {
        output.push(`- [${bookmark.title.replaceAll("]", "\\]")}](${bookmark.url})${bookmark.description ? ` — ${bookmark.description}` : ""}`);
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
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
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
      const existingPages = (await database.pages.toArray()).filter((page) => page.deletedAt === null).sort((a, b) => a.position.localeCompare(b.position));
      pageId = createId();
      const timestamp = nowIso();
      await database.pages.add({
        id: pageId,
        userId: null,
        title: destination.pageTitle.trim() || "Imported",
        icon: "download",
        accent: null,
        position: evenlySpacedRanks(existingPages.length + 1).at(-1)!,
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
    const existingBoards = (await database.boards.where("pageId").equals(pageId).toArray()).filter((board) => board.deletedAt === null);
    let imported = 0;
    let skippedDuplicates = 0;
    for (const [folderTitle, group] of folderGroups) {
      let board = existingBoards.find((candidate) => candidate.title === folderTitle);
      if (!board) {
        const timestamp = nowIso();
        board = {
          id: createId(), userId: null, pageId, title: folderTitle.slice(0, 240), icon: "folder", accent: null,
          position: evenlySpacedRanks(existingBoards.length + 1).at(-1)!, collapsed: false, layout: "list",
          bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3,
          createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1,
        };
        await database.boards.add(board);
        existingBoards.push(board);
      }
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
      const ranks = evenlySpacedRanks(current.length + accepted.length).slice(current.length);
      const timestamp = nowIso();
      if (accepted.length > 0) {
        await database.bookmarks.bulkAdd(accepted.map((record, index) => ({
          id: createId(), userId: null, boardId: board.id, title: record.title.slice(0, 240), url: record.url,
          normalizedUrl: record.normalizedUrl, hostname: record.hostname, description: record.description?.slice(0, 2000) ?? null,
          faviconUrl: null, customIcon: null, position: ranks[index]!, openMode: "current" as const, pinned: false,
          createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1,
        })));
      }
      imported += accepted.length;
    }
    return { imported, skippedDuplicates, invalid };
  });
}
