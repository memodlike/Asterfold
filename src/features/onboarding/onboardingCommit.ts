import type { AsterfoldDatabase } from "../../db/database";
import { db } from "../../db/database";
import { auditInvariants, getWorkspaceData, updateSettings } from "../../db/repository";
import { ImportError } from "../../domain/errors";
import {
  createBackup,
  importRecords,
  restoreBackup,
  type ImportSummary,
} from "../../services/exportImport";
import { CURRENT_ONBOARDING_VERSION, type OnboardingPlan } from "./onboardingState";

export interface OnboardingCommitResult {
  status: "completed" | "already-complete";
  imported: number;
  skippedDuplicates: number;
}

export class OnboardingCommitError extends Error {
  public readonly rollbackFailed: boolean;

  public constructor(message: string, rollbackFailed = false) {
    super(message);
    this.name = "OnboardingCommitError";
    this.rollbackFailed = rollbackFailed;
  }
}

let inFlight: Promise<OnboardingCommitResult> | null = null;

async function performCommit(plan: OnboardingPlan, database: AsterfoldDatabase): Promise<OnboardingCommitResult> {
  const current = await getWorkspaceData(database);
  if (current.settings.onboardingVersion === CURRENT_ONBOARDING_VERSION && current.settings.onboardingComplete) {
    return { status: "already-complete", imported: 0, skippedDuplicates: 0 };
  }

  const recovery = await createBackup({}, database);
  let importSummary: ImportSummary = { imported: 0, skippedDuplicates: 0, invalid: [] };
  try {
    if (plan.source === "backup") {
      if (!plan.backup) throw new ImportError("A validated backup is required");
      await restoreBackup(plan.backup, plan.backup.scope === "full" ? "replace" : "merge", database);
      importSummary = {
        imported: plan.backup.entities.bookmarks.length,
        skippedDuplicates: 0,
        invalid: [],
      };
    } else if (plan.source === "chrome" || plan.source === "html") {
      if (plan.records.length === 0) throw new ImportError("A validated bookmark preview is required");
      importSummary = await importRecords(
        plan.records,
        { pageTitle: plan.importPageTitle },
        plan.duplicateStrategy,
        database,
      );
    }

    await updateSettings({
      locale: plan.locale,
      theme: plan.theme,
      workspaceLayoutMode: plan.workspaceLayoutMode,
      workspaceRows: plan.workspaceRows,
      duplicateStrategy: plan.duplicateStrategy,
      onboardingVersion: CURRENT_ONBOARDING_VERSION,
      onboardingComplete: true,
    }, database);

    const issues = await auditInvariants(database);
    if (issues.length > 0) throw new OnboardingCommitError(`Workspace invariant check failed: ${issues[0]}`);

    return {
      status: "completed",
      imported: importSummary.imported,
      skippedDuplicates: importSummary.skippedDuplicates,
    };
  } catch (error) {
    let rollbackFailed = false;
    try {
      await restoreBackup(recovery, "replace", database);
      await updateSettings({
        onboardingVersion: CURRENT_ONBOARDING_VERSION,
        onboardingComplete: false,
      }, database);
    } catch {
      rollbackFailed = true;
    }
    const message = error instanceof Error ? error.message : "Onboarding commit failed";
    throw new OnboardingCommitError(message, rollbackFailed);
  }
}

export async function commitOnboardingPlan(
  plan: OnboardingPlan,
  database: AsterfoldDatabase = db,
): Promise<OnboardingCommitResult> {
  if (inFlight) return inFlight;
  inFlight = performCommit(plan, database);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function resetOnboardingCommitGuardForTests(): void {
  inFlight = null;
}
