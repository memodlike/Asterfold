import type { Transaction } from "dexie";
import type { AppSettings, SyncState } from "../domain/models";
import { getThemePreset } from "../domain/themes";
import { createId, nowIso } from "../utils/ids";

export const CURRENT_DB_SCHEMA_VERSION = 2;

export const V1_STORES = {
  pages: "id, userId, position, updatedAt, deletedAt, isDefault",
  boards: "id, pageId, userId, position, updatedAt, deletedAt",
  bookmarks: "id, boardId, userId, position, hostname, normalizedUrl, updatedAt, deletedAt, pinned",
  settings: "id, updatedAt",
  wallpapers: "id, kind, updatedAt",
  syncOperations: "id, entityType, entityId, createdAt, nextAttemptAt",
  syncState: "id, userId, status",
  snapshots: "id, createdAt, reason",
  diagnostics: "id, level, area, createdAt",
} as const;

export const V2_STORES = {
  ...V1_STORES,
  boards: `${V1_STORES.boards}, [pageId+position]`,
  bookmarks: `${V1_STORES.bookmarks}, [boardId+position], [boardId+normalizedUrl]`,
} as const;

type LegacySettings = Partial<AppSettings> & Pick<AppSettings, "id">;

export async function migrateToV2(transaction: Transaction): Promise<void> {
  const timestamp = nowIso();
  const settingsTable = transaction.table<LegacySettings, string>("settings");
  const current = await settingsTable.get("app");
  if (current) {
    const fallbackTheme = getThemePreset("frost-light");
    await settingsTable.put({
      ...current,
      id: "app",
      schemaVersion: CURRENT_DB_SCHEMA_VERSION,
      activePageId: current.activePageId ?? null,
      navigationMode: current.navigationMode ?? "expanded",
      theme: { ...fallbackTheme, ...current.theme },
      privacyPersist: current.privacyPersist ?? false,
      privacyEnabled: current.privacyPersist ? current.privacyEnabled ?? false : false,
      quickSaveMode: current.quickSaveMode ?? "ask",
      quickSaveDefaultPageId: current.quickSaveDefaultPageId ?? null,
      quickSaveDefaultBoardId: current.quickSaveDefaultBoardId ?? null,
      quickSaveLastPageId: current.quickSaveLastPageId ?? null,
      quickSaveLastBoardId: current.quickSaveLastBoardId ?? null,
      duplicateStrategy: current.duplicateStrategy ?? "warn",
      trashRetentionDays: current.trashRetentionDays ?? 30,
      recentQueries: current.recentQueries?.slice(0, 20) ?? [],
      onboardingComplete: current.onboardingComplete ?? false,
      updatedAt: timestamp,
    });
  }

  const syncTable = transaction.table<SyncState, string>("syncState");
  if (!(await syncTable.get("sync"))) {
    await syncTable.put({
      id: "sync",
      userId: null,
      deviceId: createId(),
      status: "disabled",
      cursor: 0,
      lastSyncAt: null,
      lastError: null,
      updatedAt: timestamp,
    });
  }
}
