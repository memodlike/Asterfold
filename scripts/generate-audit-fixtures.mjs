import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const fixtureRoot = join(root, "tests/fixtures/audit");
const migrationRoot = join(fixtureRoot, "migrations");
const backupRoot = join(fixtureRoot, "backups");
const timestamp = "2025-01-02T03:04:05.000Z";
const deletedAt = "2025-02-03T04:05:06.000Z";
const modes = ["current", "new-tab", "new-window", "incognito"];

function rank(index) {
  return index.toString(36).padStart(12, "0");
}

function page(overrides = {}) {
  return {
    id: "page-active",
    userId: null,
    title: "Audit workspace",
    icon: null,
    accent: null,
    position: rank(1),
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
    ...overrides,
  };
}

function board(overrides = {}) {
  return {
    id: "board-main",
    userId: null,
    pageId: "page-active",
    title: "Audit board",
    icon: null,
    accent: null,
    position: rank(1),
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

function bookmark(index, overrides = {}) {
  const mode = modes[index % modes.length];
  const url = `https://example.test/audit/${index}?mode=${mode}`;
  return {
    id: `bookmark-${String(index).padStart(3, "0")}`,
    userId: null,
    boardId: "board-main",
    title: `Audit bookmark ${index}`,
    url,
    normalizedUrl: url,
    hostname: "example.test",
    description: `Fixture bookmark using ${mode}`,
    faviconUrl: index === 0 ? "https://remote.invalid/favicon.ico" : null,
    customIcon: null,
    position: rank(index + 1),
    openMode: mode,
    pinned: index % 7 === 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
    ...overrides,
  };
}

const frostThemeV2 = {
  preset: "frost-light",
  mode: "system",
  accent: "#155eef",
  canvas: "#f5f7fb",
  surfaceOpacity: 0.82,
  blur: 20,
  radius: 14,
  density: "comfortable",
  fontScale: 1,
  boardWidth: 360,
  cardVariant: "standard",
  showHostname: true,
  showDescription: true,
  faviconSize: 32,
  motion: true,
  wallpaperId: null,
  wallpaperDim: 0.2,
  wallpaperBlur: 0,
  wallpaperSaturation: 1,
  wallpaperPosition: "center",
  wallpaperZoom: 1,
};

const fullTheme = {
  ...frostThemeV2,
  lowPowerMode: false,
  bookmarkHoverMotion: true,
  menuMotion: true,
  dragMotion: true,
  glassVariant: "regular",
  backgroundMode: "wallpaper",
  wallpaperId: "wallpaper-upload",
};

function fullSettings(schemaVersion, overrides = {}) {
  return {
    id: "app",
    schemaVersion,
    activePageId: "page-active",
    navigationMode: "expanded",
    locale: "auto",
    workspaceLayoutMode: "auto",
    workspaceRows: 2,
    workspaceAlignment: "center",
    theme: fullTheme,
    privacyPersist: false,
    privacyEnabled: false,
    quickSaveMode: "instant",
    quickSaveDefaultPageId: "page-missing",
    quickSaveDefaultBoardId: "board-missing",
    quickSaveLastPageId: "page-deleted",
    quickSaveLastBoardId: "board-deleted",
    duplicateStrategy: "warn",
    trashRetentionDays: 30,
    recentQueries: ["audit", "lossless"],
    onboardingComplete: true,
    updatedAt: timestamp,
    ...overrides,
  };
}

function deletedHierarchy() {
  return {
    pages: [page({ id: "page-deleted", title: "Deleted page", isDefault: false, position: rank(2), deletedAt, deletedBatchId: "batch-delete" })],
    boards: [board({ id: "board-deleted", pageId: "page-deleted", title: "Deleted board", position: rank(2), deletedAt, deletedBatchId: "batch-delete" })],
    bookmarks: [bookmark(900, { id: "bookmark-deleted", boardId: "board-deleted", title: "Deleted bookmark", deletedAt, deletedBatchId: "batch-delete" })],
  };
}

function uploadedWallpaper() {
  return {
    id: "wallpaper-upload",
    kind: "upload",
    name: "Audit 1x1 WebP",
    mimeType: "image/webp",
    blobBase64: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==",
    thumbnailBase64: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const deleted = deletedHierarchy();
const fixtures = [
  {
    fixtureFormat: 1,
    dbVersion: 1,
    description: "Sparse v1 data with all open modes and no post-v1 settings fields.",
    stores: {
      pages: [page()],
      boards: [board({ bookmarkColumns: undefined, gridColumn: undefined, gridRow: undefined, gridSpan: undefined })],
      bookmarks: modes.map((_, index) => bookmark(index)),
      settings: [{ id: "app", schemaVersion: 1, activePageId: "page-active", navigationMode: "rail", updatedAt: timestamp }],
      wallpapers: [],
      syncOperations: [],
      syncState: [],
      snapshots: [],
      diagnostics: [],
    },
  },
  {
    fixtureFormat: 1,
    dbVersion: 2,
    description: "v2 settings with stale Quick Save destinations.",
    stores: {
      pages: [page()],
      boards: [board({ bookmarkColumns: undefined, gridColumn: undefined, gridRow: undefined, gridSpan: undefined })],
      bookmarks: modes.map((_, index) => bookmark(index)),
      settings: [{
        ...fullSettings(2),
        locale: undefined,
        workspaceLayoutMode: undefined,
        workspaceRows: undefined,
        workspaceAlignment: undefined,
        theme: frostThemeV2,
      }],
      wallpapers: [],
      syncOperations: [],
      syncState: [],
      snapshots: [],
      diagnostics: [],
    },
  },
  {
    fixtureFormat: 1,
    dbVersion: 3,
    description: "v3 data with a deleted Page → Board → Bookmark hierarchy.",
    stores: {
      pages: [page(), ...deleted.pages],
      boards: [board(), ...deleted.boards],
      bookmarks: [...modes.map((_, index) => bookmark(index)), ...deleted.bookmarks],
      settings: [fullSettings(3)],
      wallpapers: [],
      syncOperations: [],
      syncState: [],
      snapshots: [],
      diagnostics: [],
    },
  },
  {
    fixtureFormat: 1,
    dbVersion: 4,
    description: "v4 data with a local uploaded wallpaper representation.",
    stores: {
      pages: [page()],
      boards: [board()],
      bookmarks: modes.map((_, index) => bookmark(index)),
      settings: [fullSettings(4)],
      wallpapers: [uploadedWallpaper()],
      syncOperations: [],
      syncState: [],
      snapshots: [],
      diagnostics: [],
    },
  },
  {
    fixtureFormat: 1,
    dbVersion: 5,
    description: "v5 scale fixture with 100 bookmarks, corrupt ranks, stale refs, wallpaper, and optional outbox state.",
    stores: {
      pages: [page(), ...deleted.pages],
      boards: [board(), ...deleted.boards],
      bookmarks: [
        ...Array.from({ length: 100 }, (_, index) => bookmark(index, index === 98
          ? { position: "corrupt-rank" }
          : index === 99
            ? { position: rank(98) }
            : {})),
        ...deleted.bookmarks,
      ],
      settings: [fullSettings(5)],
      wallpapers: [uploadedWallpaper()],
      syncOperations: [{
        id: "sync-operation-pending",
        entityType: "bookmark",
        entityId: "bookmark-000",
        operation: "upsert",
        payload: { title: "Pending offline edit" },
        expectedVersion: 1,
        attempts: 2,
        createdAt: timestamp,
        nextAttemptAt: timestamp,
        error: "offline",
      }],
      syncState: [{
        id: "sync",
        userId: "audit-user",
        deviceId: "audit-device",
        status: "offline",
        cursor: 42,
        lastSyncAt: null,
        lastError: "offline",
        updatedAt: timestamp,
      }],
      snapshots: [],
      diagnostics: [],
    },
  },
];

function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

function goldenBackup(exportVersion) {
  const isV1 = exportVersion === 1;
  const backupBoards = [board()];
  const backupSettings = fullSettings(isV1 ? 3 : 5, {
    theme: isV1 ? frostThemeV2 : fullTheme,
  });
  if (isV1) {
    for (const key of ["locale", "workspaceLayoutMode", "workspaceRows", "workspaceAlignment"]) delete backupSettings[key];
    for (const key of ["bookmarkColumns", "gridColumn", "gridRow", "gridSpan"]) delete backupBoards[0][key];
  }
  return stripUndefined({
    schemaVersion: exportVersion,
    exportVersion,
    exportedAt: timestamp,
    appVersion: isV1 ? "2.0.0" : "2.1.3",
    scope: "full",
    entities: {
      pages: [page()],
      boards: backupBoards,
      bookmarks: modes.map((_, index) => bookmark(index)),
    },
    settings: backupSettings,
    theme: backupSettings.theme,
  });
}

await mkdir(migrationRoot, { recursive: true });
await mkdir(backupRoot, { recursive: true });
for (const fixture of fixtures) {
  await writeFile(
    join(migrationRoot, `db-v${fixture.dbVersion}.json`),
    `${JSON.stringify(stripUndefined(fixture), null, 2)}\n`,
    "utf8",
  );
}
for (const version of [1, 2]) {
  await writeFile(
    join(backupRoot, `backup-v${version}-golden.json`),
    `${JSON.stringify(goldenBackup(version), null, 2)}\n`,
    "utf8",
  );
}

console.log(`Audit fixtures written to ${fixtureRoot}`);
