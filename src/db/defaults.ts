import type { AppSettings } from "../domain/models";
import { getThemePreset } from "../domain/themes";
import { nowIso } from "../utils/ids";
import { CURRENT_DB_SCHEMA_VERSION } from "./migrations";
import { CURRENT_ONBOARDING_VERSION } from "../features/onboarding/onboardingState";

export function createDefaultSettings(): AppSettings {
  return {
    id: "app",
    schemaVersion: CURRENT_DB_SCHEMA_VERSION,
    activePageId: null,
    navigationMode: "expanded",
    locale: "auto",
    workspaceLayoutMode: "auto",
    workspaceRows: 2,
    workspaceAlignment: "center",
    theme: { ...getThemePreset("frost-light"), mode: "system", backgroundMode: "auto", surfaceOpacity: 0.62, blur: 24, radius: 17 },
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
    onboardingVersion: CURRENT_ONBOARDING_VERSION,
    onboardingComplete: false,
    updatedAt: nowIso(),
  };
}
