import { z } from "zod";
import type { ThemeConfig } from "./models";
import { isValidRank } from "./ordering";

const MAX_ID = 128;
const MAX_PAGES = 10_000;
const MAX_BOARDS = 50_000;
const MAX_BOOKMARKS = 50_000;
const id = z.string().min(1).max(MAX_ID);
const nullableId = id.nullable();
const isoDate = z.string().datetime({ offset: true });
const finite = z.number().finite();

const baseEntitySchema = z.object({
  id,
  userId: z.string().max(MAX_ID).nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.nullable(),
  deletedBatchId: z.string().max(MAX_ID).nullable(),
  version: finite.int().positive(),
}).strict();

export const pageSchema = baseEntitySchema.extend({
  title: z.string().max(240),
  icon: z.string().max(128).nullable(),
  accent: z.string().max(64).nullable(),
  position: z.string().refine(isValidRank, "Invalid Page rank"),
  isDefault: z.boolean(),
}).strict();

export const boardSchema = baseEntitySchema.extend({
  pageId: id,
  title: z.string().max(240),
  icon: z.string().max(128).nullable(),
  accent: z.string().max(64).nullable(),
  position: z.string().refine(isValidRank, "Invalid Board rank"),
  collapsed: z.boolean(),
  layout: z.enum(["list", "grid"]),
  bookmarkColumns: z.union([z.literal("auto"), z.literal(1), z.literal(2)]).default("auto"),
  gridColumn: finite.int().min(1).max(12).default(1),
  gridRow: z.union([z.literal(0), z.literal(1)]).default(0),
  gridSpan: finite.int().min(2).max(6).default(3),
}).strict();

export const bookmarkSchema = baseEntitySchema.extend({
  boardId: id,
  title: z.string().max(240),
  url: z.string().max(8_192),
  normalizedUrl: z.string().max(8_192),
  hostname: z.string().max(512),
  description: z.string().max(2_000).nullable(),
  faviconUrl: z.string().max(8_192).nullable(),
  customIcon: z.string().max(2_000_000).nullable(),
  position: z.string().refine(isValidRank, "Invalid Bookmark rank"),
  openMode: z.enum(["current", "new-tab", "new-window", "incognito"]),
  pinned: z.boolean(),
}).strict();

export const themeSchema: z.ZodType<ThemeConfig> = z.object({
  preset: z.enum(["frost-light", "graphite-dark", "midnight", "aurora", "warm-paper", "high-contrast"]),
  mode: z.enum(["system", "light", "dark"]),
  accent: z.string().max(64),
  canvas: z.string().max(64),
  surfaceOpacity: finite.min(0).max(1),
  blur: finite.min(0).max(32),
  radius: finite.min(0).max(40),
  density: z.enum(["compact", "comfortable", "spacious"]),
  fontScale: finite.min(0.75).max(2),
  boardWidth: finite.min(160).max(800),
  cardVariant: z.enum(["minimal", "standard", "visual"]),
  showHostname: z.boolean(),
  showDescription: z.boolean(),
  faviconSize: finite.min(8).max(64),
  motion: z.boolean(),
  lowPowerMode: z.boolean().default(false),
  bookmarkHoverMotion: z.boolean().default(true),
  menuMotion: z.boolean().default(true),
  dragMotion: z.boolean().default(true),
  wallpaperId: nullableId,
  wallpaperDim: finite.min(0).max(1),
  wallpaperBlur: finite.min(0).max(32),
  wallpaperSaturation: finite.min(0).max(2),
  wallpaperPosition: z.string().max(64),
  wallpaperZoom: finite.min(0.25).max(4),
  glassVariant: z.enum(["regular", "clear"]).default("regular"),
  backgroundMode: z.enum(["auto", "solid", "wallpaper"]).default("auto"),
}).strict();

export const appSettingsSchema = z.object({
  id: z.literal("app"),
  schemaVersion: finite.int().positive(),
  activePageId: nullableId,
  navigationMode: z.enum(["rail", "expanded"]),
  locale: z.enum(["auto", "ru", "kk", "en", "es", "de", "fr", "it", "pt", "pl", "uk", "tr", "nl"]).default("auto"),
  workspaceLayoutMode: z.enum(["auto", "free"]).default("auto"),
  workspaceRows: z.union([z.literal(1), z.literal(2)]).default(2),
  workspaceAlignment: z.enum(["left", "center", "right"]).default("center"),
  theme: themeSchema,
  privacyPersist: z.boolean(),
  privacyEnabled: z.boolean(),
  quickSaveMode: z.enum(["ask", "instant"]),
  quickSaveDefaultPageId: nullableId,
  quickSaveDefaultBoardId: nullableId,
  quickSaveLastPageId: nullableId,
  quickSaveLastBoardId: nullableId,
  duplicateStrategy: z.enum(["warn", "skip", "allow"]),
  trashRetentionDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]),
  recentQueries: z.array(z.string().max(512)).max(20),
  onboardingComplete: z.boolean(),
  updatedAt: isoDate,
}).strict();

export const wallpaperMetadataSchema = z.object({
  id,
  kind: z.enum(["builtin", "upload", "gradient"]),
  name: z.string().max(240),
  mimeType: z.string().max(128),
  value: z.string().max(8_192).nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict();

export const snapshotSchema = z.object({
  id,
  schemaVersion: finite.int().positive(),
  createdAt: isoDate,
  reason: z.string().max(240),
  checksum: z.string().max(128),
  payload: z.unknown(),
}).strict();

export const syncOperationSchema = z.object({
  id,
  entityType: z.enum(["page", "board", "bookmark", "settings", "theme"]),
  entityId: id,
  operation: z.enum(["upsert", "delete", "restore"]),
  payload: z.unknown(),
  expectedVersion: finite.int().nonnegative(),
  attempts: finite.int().nonnegative().max(100),
  createdAt: isoDate,
  nextAttemptAt: isoDate,
  error: z.string().max(2_000).nullable(),
}).strict();

const backupCoreSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: isoDate,
  appVersion: z.string().min(1).max(64),
  scope: z.enum(["full", "page", "board"]),
  entities: z.object({
    pages: z.array(pageSchema).max(MAX_PAGES),
    boards: z.array(boardSchema).max(MAX_BOARDS),
    bookmarks: z.array(bookmarkSchema).max(MAX_BOOKMARKS),
  }).strict(),
  settings: appSettingsSchema.optional(),
  theme: themeSchema.optional(),
}).strict();

function duplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

export const backupSchema = backupCoreSchema.superRefine((backup, context) => {
  for (const [kind, entities] of Object.entries(backup.entities)) {
    const duplicateId = duplicate(entities.map((entity) => entity.id));
    if (duplicateId) context.addIssue({ code: "custom", message: `Duplicate ${kind} ID: ${duplicateId}` });
  }
  const pages = new Map(backup.entities.pages.map((page) => [page.id, page]));
  const boards = new Map(backup.entities.boards.map((board) => [board.id, board]));
  const activePages = backup.entities.pages.filter((page) => page.deletedAt === null);
  if (backup.scope === "full" && activePages.filter((page) => page.isDefault).length !== 1) {
    context.addIssue({ code: "custom", message: "Exactly one active default Page is required" });
  }
  const rankScopes: Array<[string, string[]]> = [["pages", backup.entities.pages.map((page) => page.position)]];
  for (const page of backup.entities.pages) {
    rankScopes.push([`boards:${page.id}`, backup.entities.boards.filter((board) => board.pageId === page.id).map((board) => board.position)]);
  }
  for (const board of backup.entities.boards) {
    rankScopes.push([`bookmarks:${board.id}`, backup.entities.bookmarks.filter((bookmark) => bookmark.boardId === board.id).map((bookmark) => bookmark.position)]);
  }
  for (const [scope, ranks] of rankScopes) {
    const duplicateRank = duplicate(ranks);
    if (duplicateRank) context.addIssue({ code: "custom", message: `Duplicate rank in ${scope}: ${duplicateRank}` });
  }
  for (const board of backup.entities.boards) {
    const parent = pages.get(board.pageId);
    if (!parent) context.addIssue({ code: "custom", message: `Board ${board.id} has no parent Page` });
    else if (board.deletedAt === null && parent.deletedAt !== null) context.addIssue({ code: "custom", message: `Active Board ${board.id} has a deleted parent` });
  }
  for (const bookmark of backup.entities.bookmarks) {
    const parent = boards.get(bookmark.boardId);
    if (!parent) context.addIssue({ code: "custom", message: `Bookmark ${bookmark.id} has no parent Board` });
    else if (bookmark.deletedAt === null && parent.deletedAt !== null) context.addIssue({ code: "custom", message: `Active Bookmark ${bookmark.id} has a deleted parent` });
  }
  if (backup.scope === "full" && backup.settings) {
    const settings = backup.settings;
    if (settings.activePageId && pages.get(settings.activePageId)?.deletedAt !== null) {
      context.addIssue({ code: "custom", message: "Active Page setting has no active parent" });
    }
    for (const [label, pageId, boardId] of [
      ["default", settings.quickSaveDefaultPageId, settings.quickSaveDefaultBoardId],
      ["last", settings.quickSaveLastPageId, settings.quickSaveLastBoardId],
    ] as const) {
      if (pageId && pages.get(pageId)?.deletedAt !== null) context.addIssue({ code: "custom", message: `Quick Save ${label} Page is invalid` });
      if (boardId && (boards.get(boardId)?.deletedAt !== null || boards.get(boardId)?.pageId !== pageId)) {
        context.addIssue({ code: "custom", message: `Quick Save ${label} Board is invalid` });
      }
    }
  }
});

export type AsterfoldBackup = z.infer<typeof backupSchema>;
