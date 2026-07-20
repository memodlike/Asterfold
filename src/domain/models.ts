export type EntityId = string;
export type ISODate = string;

export interface Page {
  id: EntityId;
  userId: string | null;
  title: string;
  icon: string | null;
  accent: string | null;
  position: string;
  isDefault: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt: ISODate | null;
  deletedBatchId: string | null;
  version: number;
}

export interface Board {
  id: EntityId;
  userId: string | null;
  pageId: EntityId;
  title: string;
  icon: string | null;
  accent: string | null;
  position: string;
  collapsed: boolean;
  layout: "list" | "grid";
  bookmarkColumns: "auto" | 1 | 2;
  gridColumn: number;
  gridRow: 0 | 1;
  gridSpan: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt: ISODate | null;
  deletedBatchId: string | null;
  version: number;
}

export type BookmarkOpenMode = "current" | "new-tab" | "new-window" | "incognito";

export interface Bookmark {
  id: EntityId;
  userId: string | null;
  boardId: EntityId;
  title: string;
  url: string;
  normalizedUrl: string;
  hostname: string;
  description: string | null;
  faviconUrl: string | null;
  customIcon: string | null;
  position: string;
  openMode: BookmarkOpenMode;
  pinned: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt: ISODate | null;
  deletedBatchId: string | null;
  version: number;
}

export type ThemePresetId =
  | "frost-light"
  | "graphite-dark"
  | "midnight"
  | "aurora"
  | "warm-paper"
  | "high-contrast";

export type ThemeMode = "system" | "light" | "dark";
export type Density = "compact" | "comfortable" | "spacious";
export type CardVariant = "minimal" | "standard" | "visual";
export type GlassVariant = "regular" | "clear";
export type BackgroundMode = "auto" | "solid" | "wallpaper";
export type LocalePreference = "auto" | "ru" | "kk";
export type WorkspaceLayoutMode = "auto" | "free";
export type WorkspaceAlignment = "left" | "center" | "right";

export interface ThemeConfig {
  preset: ThemePresetId;
  mode: ThemeMode;
  accent: string;
  canvas: string;
  surfaceOpacity: number;
  blur: number;
  radius: number;
  density: Density;
  fontScale: number;
  boardWidth: number;
  cardVariant: CardVariant;
  showHostname: boolean;
  showDescription: boolean;
  faviconSize: number;
  motion: boolean;
  lowPowerMode: boolean;
  bookmarkHoverMotion: boolean;
  menuMotion: boolean;
  dragMotion: boolean;
  wallpaperId: string | null;
  wallpaperDim: number;
  wallpaperBlur: number;
  wallpaperSaturation: number;
  wallpaperPosition: string;
  wallpaperZoom: number;
  glassVariant: GlassVariant;
  backgroundMode: BackgroundMode;
}

export interface AppSettings {
  id: "app";
  schemaVersion: number;
  activePageId: EntityId | null;
  navigationMode: "rail" | "expanded";
  locale: LocalePreference;
  workspaceLayoutMode: WorkspaceLayoutMode;
  workspaceRows: 1 | 2;
  workspaceAlignment: WorkspaceAlignment;
  theme: ThemeConfig;
  privacyPersist: boolean;
  privacyEnabled: boolean;
  quickSaveMode: "ask" | "instant";
  quickSaveDefaultPageId: EntityId | null;
  quickSaveDefaultBoardId: EntityId | null;
  quickSaveLastPageId: EntityId | null;
  quickSaveLastBoardId: EntityId | null;
  duplicateStrategy: "warn" | "skip" | "allow";
  trashRetentionDays: 7 | 30 | 90 | null;
  recentQueries: string[];
  onboardingComplete: boolean;
  updatedAt: ISODate;
}

export interface Wallpaper {
  id: EntityId;
  kind: "builtin" | "upload" | "gradient";
  name: string;
  mimeType: string;
  blob: Blob | null;
  thumbnail: Blob | null;
  value: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Snapshot {
  id: EntityId;
  schemaVersion: number;
  createdAt: ISODate;
  reason: string;
  checksum: string;
  payload: unknown;
}

export interface SyncOperation {
  id: EntityId;
  entityType: "page" | "board" | "bookmark" | "settings" | "theme";
  entityId: EntityId;
  operation: "upsert" | "delete" | "restore";
  payload: unknown;
  expectedVersion: number;
  attempts: number;
  createdAt: ISODate;
  nextAttemptAt: ISODate;
  error: string | null;
}

export interface SyncState {
  id: "sync";
  userId: string | null;
  deviceId: string;
  status: "disabled" | "idle" | "syncing" | "offline" | "error";
  cursor: number;
  lastSyncAt: ISODate | null;
  lastError: string | null;
  updatedAt: ISODate;
}

export interface DiagnosticEvent {
  id: EntityId;
  level: "info" | "warning" | "error";
  area: "database" | "import" | "sync" | "browser" | "migration";
  message: string;
  details: string | null;
  createdAt: ISODate;
}

export interface WorkspaceData {
  pages: Page[];
  boards: Board[];
  bookmarks: Bookmark[];
  settings: AppSettings;
}

export interface NewBookmarkInput {
  boardId: EntityId;
  title: string;
  url: string;
  description?: string | null;
  faviconUrl?: string | null;
  openMode?: BookmarkOpenMode;
  pinned?: boolean;
}

export interface BookmarkPatch {
  title?: string;
  url?: string;
  description?: string | null;
  boardId?: EntityId;
  openMode?: BookmarkOpenMode;
  pinned?: boolean;
  customIcon?: string | null;
}
