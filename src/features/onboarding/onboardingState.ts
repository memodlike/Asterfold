import type {
  Density,
  LocalePreference,
  ThemeConfig,
  ThemeMode,
  ThemePresetId,
  WorkspaceLayoutMode,
} from "../../domain/models";
import type { AsterfoldBackup, ImportRecord } from "../../services/exportImport";

export const CURRENT_ONBOARDING_VERSION = 1;
export const ONBOARDING_STEPS = ["welcome", "import", "appearance", "review"] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];
export type OnboardingSource = "default" | "chrome" | "html" | "backup";
export type DuplicateImportStrategy = "skip" | "allow";

export interface OnboardingImportPreview {
  source: OnboardingSource;
  label: string;
  bookmarks: number;
  folders: number;
  pages: number;
  boards: number;
  invalid: number;
  skipped: number;
  estimatedBytes: number;
  destructive: boolean;
}

export interface OnboardingPlan {
  locale: LocalePreference;
  source: OnboardingSource;
  records: ImportRecord[];
  backup: AsterfoldBackup | null;
  preview: OnboardingImportPreview | null;
  duplicateStrategy: DuplicateImportStrategy;
  importPageTitle: string;
  theme: ThemeConfig;
  workspaceLayoutMode: WorkspaceLayoutMode;
  workspaceRows: 1 | 2;
}

export interface AppearanceSelection {
  mode: ThemeMode;
  preset: ThemePresetId;
  density: Density;
  workspaceLayoutMode: WorkspaceLayoutMode;
  workspaceRows: 1 | 2;
}

export function shouldShowOnboarding(settings: {
  onboardingVersion?: number;
  onboardingComplete?: boolean;
}): boolean {
  return settings.onboardingVersion === CURRENT_ONBOARDING_VERSION && settings.onboardingComplete !== true;
}

export function greetingPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep {
  return ONBOARDING_STEPS[Math.min(stepIndex(step) + 1, ONBOARDING_STEPS.length - 1)]!;
}

export function previousStep(step: OnboardingStep): OnboardingStep {
  return ONBOARDING_STEPS[Math.max(stepIndex(step) - 1, 0)]!;
}

export function canContinue(step: OnboardingStep, plan: OnboardingPlan, parsing: boolean): boolean {
  if (parsing) return false;
  if (step === "welcome") return Boolean(plan.locale);
  if (step === "import") {
    if (plan.source === "default") return true;
    if (plan.source === "backup") return plan.backup !== null && plan.preview !== null;
    return plan.records.length > 0 && plan.preview !== null;
  }
  return true;
}

export function recordPreview(source: "chrome" | "html", label: string, records: ImportRecord[], estimatedBytes = 0): OnboardingImportPreview {
  const folders = new Set(records.map((record) => record.folderPath.join("/")).filter(Boolean));
  return {
    source,
    label,
    bookmarks: records.length,
    folders: folders.size,
    pages: records.length > 0 ? 1 : 0,
    boards: Math.max(1, folders.size),
    invalid: 0,
    skipped: 0,
    estimatedBytes,
    destructive: false,
  };
}

export function backupPreview(label: string, backup: AsterfoldBackup, estimatedBytes: number): OnboardingImportPreview {
  return {
    source: "backup",
    label,
    bookmarks: backup.entities.bookmarks.length,
    folders: 0,
    pages: backup.entities.pages.length,
    boards: backup.entities.boards.length,
    invalid: 0,
    skipped: 0,
    estimatedBytes,
    destructive: backup.scope === "full",
  };
}
