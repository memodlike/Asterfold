import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { ensureStarterWorkspace, getWorkspaceData } from "../src/db/repository";
import { getThemePreset } from "../src/domain/themes";
import {
  commitOnboardingPlan,
  resetOnboardingCommitGuardForTests,
} from "../src/features/onboarding/onboardingCommit";
import { CURRENT_ONBOARDING_VERSION, type OnboardingPlan } from "../src/features/onboarding/onboardingState";

function createPlan(): OnboardingPlan {
  return {
    locale: "kk",
    source: "default",
    records: [],
    backup: null,
    preview: null,
    duplicateStrategy: "skip",
    importPageTitle: "Импортталған бетбелгілер",
    theme: { ...getThemePreset("graphite-dark"), mode: "dark", density: "compact" },
    workspaceLayoutMode: "auto",
    workspaceRows: 1,
  };
}

describe("onboarding final commit", () => {
  const databases: string[] = [];

  afterEach(async () => {
    resetOnboardingCommitGuardForTests();
    await Promise.all(databases.splice(0).map((name) => Dexie.delete(name)));
  });

  async function freshDatabase(): Promise<AsterfoldDatabase> {
    const name = `asterfold-onboarding-commit-${crypto.randomUUID()}`;
    databases.push(name);
    const database = new AsterfoldDatabase(name);
    await ensureStarterWorkspace(database);
    return database;
  }

  it("commits locale, appearance, layout and lifecycle only at Finish", async () => {
    const database = await freshDatabase();
    const before = await getWorkspaceData(database);
    expect(before.settings.onboardingComplete).toBe(false);
    expect(before.settings.locale).toBe("auto");

    const result = await commitOnboardingPlan(createPlan(), database);
    const after = await getWorkspaceData(database);
    expect(result).toEqual({ status: "completed", imported: 0, skippedDuplicates: 0 });
    expect(after.settings).toMatchObject({
      locale: "kk",
      workspaceRows: 1,
      onboardingVersion: CURRENT_ONBOARDING_VERSION,
      onboardingComplete: true,
    });
    expect(after.settings.theme).toMatchObject({ preset: "graphite-dark", mode: "dark", density: "compact" });
    database.close();
  });

  it("is idempotent after successful completion", async () => {
    const database = await freshDatabase();
    const first = await commitOnboardingPlan(createPlan(), database);
    const firstWorkspace = await getWorkspaceData(database);
    const second = await commitOnboardingPlan(createPlan(), database);
    const secondWorkspace = await getWorkspaceData(database);

    expect(first.status).toBe("completed");
    expect(second).toEqual({ status: "already-complete", imported: 0, skippedDuplicates: 0 });
    expect(secondWorkspace).toEqual(firstWorkspace);
    database.close();
  });

  it("coalesces simultaneous Finish invocations into one domain operation", async () => {
    const database = await freshDatabase();
    const plan = createPlan();
    const [first, second, third] = await Promise.all([
      commitOnboardingPlan(plan, database),
      commitOnboardingPlan(plan, database),
      commitOnboardingPlan(plan, database),
    ]);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect((await getWorkspaceData(database)).settings.onboardingComplete).toBe(true);
    database.close();
  });

  it("restores the prior workspace and keeps onboarding pending after a failed restore plan", async () => {
    const database = await freshDatabase();
    const before = await getWorkspaceData(database);
    const invalid = { ...createPlan(), source: "backup" as const, backup: null };

    await expect(commitOnboardingPlan(invalid, database)).rejects.toThrow(/validated backup is required/i);
    const after = await getWorkspaceData(database);
    expect(after.pages).toEqual(before.pages);
    expect(after.boards).toEqual(before.boards);
    expect(after.bookmarks).toEqual(before.bookmarks);
    expect(after.settings.onboardingVersion).toBe(CURRENT_ONBOARDING_VERSION);
    expect(after.settings.onboardingComplete).toBe(false);
    database.close();
  });
});
