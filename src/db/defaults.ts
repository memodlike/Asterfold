import type { AppSettings } from "../domain/models";
import { getThemePreset } from "../domain/themes";
import { nowIso } from "../utils/ids";
import { CURRENT_DB_SCHEMA_VERSION } from "./migrations";

export function createDefaultSettings(): AppSettings {
  return {
    id: "app",
    schemaVersion: CURRENT_DB_SCHEMA_VERSION,
    activePageId: null,
    navigationMode: "expanded",
    theme: getThemePreset("frost-light"),
    privacyPersist: false,
    privacyEnabled: false,
    quickSaveMode: "ask",
    quickSaveDefaultPageId: null,
    quickSaveDefaultBoardId: null,
    quickSaveLastPageId: null,
    quickSaveLastBoardId: null,
    duplicateStrategy: "warn",
    trashRetentionDays: 30,
    recentQueries: [],
    onboardingComplete: false,
    updatedAt: nowIso(),
  };
}
