import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { CURRENT_DB_SCHEMA_VERSION, V7_STORES } from "../src/db/migrations";
import { CURRENT_ONBOARDING_VERSION, shouldShowOnboarding } from "../src/features/onboarding/onboardingState";

const timestamp = "2026-08-01T00:00:00.000Z";

describe("schema v8 onboarding migration", () => {
  const databases: string[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((name) => Dexie.delete(name)));
  });

  it.each([false, true])("suppresses the new blocking wizard for an existing v7 profile with legacy completion=%s", async (legacyComplete) => {
    const name = `asterfold-onboarding-v8-${legacyComplete}-${crypto.randomUUID()}`;
    databases.push(name);
    const legacy = new Dexie(name);
    legacy.version(7).stores(V7_STORES);
    await legacy.open();
    await legacy.table("settings").put({
      id: "app",
      schemaVersion: 7,
      onboardingComplete: legacyComplete,
      locale: "ru",
      updatedAt: timestamp,
    });
    await legacy.table("pages").put({
      id: "existing-page",
      userId: null,
      title: "Existing workspace",
      icon: null,
      accent: null,
      position: "hzz",
      isDefault: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      deletedBatchId: null,
      version: 1,
    });
    legacy.close();

    const upgraded = new AsterfoldDatabase(name);
    await upgraded.open();
    const settings = await upgraded.settings.get("app");
    expect(settings).toMatchObject({
      schemaVersion: CURRENT_DB_SCHEMA_VERSION,
      onboardingVersion: CURRENT_ONBOARDING_VERSION,
      onboardingComplete: true,
      locale: "ru",
    });
    expect(shouldShowOnboarding(settings!)).toBe(false);
    expect(await upgraded.pages.get("existing-page")).toMatchObject({ title: "Existing workspace", version: 1 });
    upgraded.close();
  });

  it("reopens the migrated database idempotently without changing installation state", async () => {
    const name = `asterfold-onboarding-v8-idempotent-${crypto.randomUUID()}`;
    databases.push(name);
    const legacy = new Dexie(name);
    legacy.version(7).stores(V7_STORES);
    await legacy.open();
    await legacy.table("settings").put({ id: "app", schemaVersion: 7, onboardingComplete: false, updatedAt: timestamp });
    legacy.close();

    const upgraded = new AsterfoldDatabase(name);
    await upgraded.open();
    const first = await upgraded.settings.get("app");
    upgraded.close();
    await upgraded.open();
    expect(await upgraded.settings.get("app")).toEqual(first);
    upgraded.close();
  });
});
