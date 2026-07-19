import { z } from "zod";
import type { AsterfoldDatabase } from "../db/database";
import { db } from "../db/database";
import { createSnapshot, ensureStarterWorkspace } from "../db/repository";
import type { Board, Bookmark, Page, ThemeConfig } from "../domain/models";
import { ImportError, ValidationError } from "../domain/errors";
import { evenlySpacedRanks } from "../domain/ordering";
import { normalizeUrl } from "../domain/urls";
import { createId, nowIso } from "../utils/ids";

const isoDate = z.string().datetime({ offset: true });
const nullableString = z.string().nullable();
const baseEntitySchema = z.object({
  id: z.string().min(1),
  userId: nullableString,
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.nullable(),
  deletedBatchId: nullableString,
  version: z.number().int().positive(),
});

export const pageSchema = baseEntitySchema.extend({
  title: z.string().max(240),
  icon: nullableString,
  accent: nullableString,
  position: z.string(),
  isDefault: z.boolean(),
});

export const boardSchema = baseEntitySchema.extend({
  pageId: z.string().min(1),
  title: z.string().max(240),
  icon: nullableString,
  accent: nullableString,
  position: z.string(),
  collapsed: z.boolean(),
  layout: z.enum(["list", "grid"]),
  bookmarkColumns: z.union([z.literal("auto"), z.literal(1), z.literal(2)]).default("auto"),
  gridColumn: z.number().int().min(1).max(12).default(1),
  gridRow: z.union([z.literal(0), z.literal(1)]).default(0),
  gridSpan: z.number().int().min(2).max(6).default(3),
});

export const bookmarkSchema = baseEntitySchema.extend({
  boardId: z.string().min(1),
  title: z.string().max(240),
  url: z.string().max(8192),
  normalizedUrl: z.string().max(8192),
  hostname: z.string().max(512),
  description: z.string().max(2000).nullable(),
  faviconUrl: nullableString,
  customIcon: nullableString,
  position: z.string(),
  openMode: z.enum(["current", "new-tab", "new-window", "incognito"]),
  pinned: z.boolean(),
});

export const themeSchema: z.ZodType<ThemeConfig> = z.object({
  preset: z.enum(["frost-light", "graphite-dark", "midnight", "aurora", "warm-paper", "high-contrast"]),
  mode: z.enum(["system", "light", "dark"]),
  accent: z.string(),
  canvas: z.string(),
  surfaceOpacity: z.number(),
  blur: z.number(),
  radius: z.number(),
  density: z.enum(["compact", "comfortable", "spacious"]),
  fontScale: z.number(),
  boardWidth: z.number(),
  cardVariant: z.enum(["minimal", "standard", "visual"]),
  showHostname: z.boolean(),
  showDescription: z.boolean(),
  faviconSize: z.number(),
  motion: z.boolean(),
  wallpaperId: z.string().nullable(),
  wallpaperDim: z.number(),
  wallpaperBlur: z.number(),
  wallpaperSaturation: z.number(),
  wallpaperPosition: z.string(),
  wallpaperZoom: z.number(),
  glassVariant: z.enum(["regular", "clear"]).default("regular"),
  backgroundMode: z.enum(["auto", "solid", "wallpaper"]).default("auto"),
});

export const settingsSchema = z.object({
  id: z.literal("app"),
  schemaVersion: z.number().int().positive(),
  activePageId: z.string().nullable(),
  navigationMode: z.enum(["rail", "expanded"]),
  locale: z.enum(["auto", "ru", "kk"]).default("auto"),
  workspaceLayoutMode: z.enum(["auto", "free"]).default("auto"),
  workspaceRows: z.union([z.literal(1), z.literal(2)]).default(2),
  workspaceAlignment: z.enum(["left", "center", "right"]).default("center"),
  theme: themeSchema,
  privacyPersist: z.boolean(),
  privacyEnabled: z.boolean(),
  quickSaveMode: z.enum(["ask", "instant"]),
  quickSaveDefaultPageId: z.string().nullable(),
  quickSaveDefaultBoardId: z.string().nullable(),
  quickSaveLastPageId: z.string().nullable(),
  quickSaveLastBoardId: z.string().nullable(),
  duplicateStrategy: z.enum(["warn", "skip", "allow"]),
  trashRetentionDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]),
  recentQueries: z.array(z.string()).max(20),
  onboardingComplete: z.boolean(),
  updatedAt: isoDate,
});

export const backupSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: isoDate,
  appVersion: z.string(),
  scope: z.enum(["full", "page", "board"]),
  entities: z.object({
    pages: z.array(pageSchema),
    boards: z.array(boardSchema),
    bookmarks: z.array(bookmarkSchema),
  }),
  settings: settingsSchema.optional(),
  theme: themeSchema.optional(),
});

export type AsterfoldBackup = z.infer<typeof backupSchema>;

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
    appVersion: "1.0.0",
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
  return {
    ...result.data,
    schemaVersion: 2,
    exportVersion: 2,
    ...(result.data.settings ? { settings: { ...result.data.settings, schemaVersion: 3 } } : {}),
  };
}

export async function restoreBackup(
  backup: AsterfoldBackup,
  strategy: "merge" | "replace",
  database: AsterfoldDatabase = db,
): Promise<void> {
  backupSchema.parse(backup);
  await createSnapshot(`before-${strategy}-restore`, database);
  await database.transaction("rw", database.pages, database.boards, database.bookmarks, database.settings, async () => {
    if (strategy === "replace") {
      await Promise.all([database.bookmarks.clear(), database.boards.clear(), database.pages.clear()]);
    }
    const mergeNewest = <T extends { id: string; updatedAt: string }>(incoming: T[], current: T[]): T[] => {
      const map = new Map(current.map((item) => [item.id, item]));
      for (const item of incoming) {
        const existing = map.get(item.id);
        if (!existing || item.updatedAt >= existing.updatedAt) map.set(item.id, item);
      }
      return [...map.values()];
    };
    const [currentPages, currentBoards, currentBookmarks] = strategy === "merge"
      ? await Promise.all([database.pages.toArray(), database.boards.toArray(), database.bookmarks.toArray()])
      : [[], [], []];
    await database.pages.bulkPut(mergeNewest(backup.entities.pages as Page[], currentPages));
    await database.boards.bulkPut(mergeNewest(backup.entities.boards as Board[], currentBoards));
    await database.bookmarks.bulkPut(mergeNewest(backup.entities.bookmarks as Bookmark[], currentBookmarks));
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
  const documentNode = new DOMParser().parseFromString(text, "text/html");
  const records: ImportRecord[] = [];
  for (const anchor of documentNode.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    try {
      const normalized = normalizeUrl(href, false);
      const folderPath: string[] = [];
      let node: Element | null = anchor.parentElement;
      while (node) {
        if (node.tagName === "DL") {
          const header = node.previousElementSibling?.querySelector("h3") ?? (node.previousElementSibling?.tagName === "H3" ? node.previousElementSibling : null);
          if (header?.textContent) folderPath.unshift(header.textContent.trim());
        }
        node = node.parentElement;
      }
      records.push({
        title: anchor.textContent?.trim() || normalized.hostname,
        url: normalized.url,
        description: anchor.parentElement?.nextElementSibling?.tagName === "DD" ? anchor.parentElement.nextElementSibling.textContent?.trim() ?? null : null,
        folderPath,
      });
    } catch {
      // Invalid URLs are excluded from the preview and reported by count in the caller.
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
  await createSnapshot("before-bookmark-import", database);

  return database.transaction("rw", database.pages, database.boards, database.bookmarks, async () => {
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
          faviconUrl: null, customIcon: null, position: ranks[index]!, openMode: "new-tab" as const, pinned: false,
          createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1,
        })));
      }
      imported += accepted.length;
    }
    return { imported, skippedDuplicates, invalid };
  });
}
