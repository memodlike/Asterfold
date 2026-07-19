import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { CURRENT_DB_SCHEMA_VERSION, V1_STORES } from "../src/db/migrations";

describe("database migrations", () => {
  const names: string[] = [];

  afterEach(async () => {
    await Promise.all(names.splice(0).map(async (name) => Dexie.delete(name)));
  });

  it("upgrades a sparse v1 settings fixture without deleting local data", async () => {
    const name = `asterfold-migration-${crypto.randomUUID()}`;
    names.push(name);
    const legacy = new Dexie(name);
    legacy.version(1).stores(V1_STORES);
    await legacy.open();
    await legacy.table("settings").put({
      id: "app",
      schemaVersion: 1,
      activePageId: null,
      navigationMode: "rail",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    await legacy.table("pages").put({
      id: "kept-page",
      userId: null,
      title: "Kept from v1",
      icon: null,
      accent: null,
      position: "hzzzzzzzzzzz",
      isDefault: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      deletedAt: null,
      deletedBatchId: null,
      version: 1,
    });
    legacy.close();

    const upgraded = new AsterfoldDatabase(name);
    await upgraded.open();
    expect((await upgraded.settings.get("app"))?.schemaVersion).toBe(CURRENT_DB_SCHEMA_VERSION);
    expect((await upgraded.settings.get("app"))?.theme.preset).toBe("frost-light");
    expect((await upgraded.pages.get("kept-page"))?.title).toBe("Kept from v1");
    expect((await upgraded.syncState.get("sync"))?.status).toBe("disabled");
    expect(upgraded.bookmarks.schema.idxByName["[boardId+normalizedUrl]"]).toBeDefined();
    upgraded.close();
  });
});
