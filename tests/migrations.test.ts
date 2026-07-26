import Dexie from "dexie";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import {
  CURRENT_DB_SCHEMA_VERSION,
  migrateToV2,
  V1_STORES,
  V2_STORES,
  V3_STORES,
  V4_STORES,
  V5_STORES,
} from "../src/db/migrations";

interface MigrationFixture {
  dbVersion: 1 | 2 | 3 | 4 | 5;
  stores: Record<string, unknown[]>;
}

const storesByVersion = {
  1: V1_STORES,
  2: V2_STORES,
  3: V3_STORES,
  4: V4_STORES,
  5: V5_STORES,
} as const;

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

  it("upgrades schema 2 layout data to schema 3 without losing boards", async () => {
    const name = `asterfold-migration-v2-${crypto.randomUUID()}`;
    names.push(name);
    const legacy = new Dexie(name);
    legacy.version(2).stores(V2_STORES);
    await legacy.open();
    const timestamp = "2024-01-01T00:00:00.000Z";
    await legacy.table("settings").put({
      id: "app", schemaVersion: 2, activePageId: "page", navigationMode: "expanded",
      theme: { preset: "frost-light", mode: "system", accent: "#155eef", canvas: "#f5f7fb", surfaceOpacity: .82, blur: 20, radius: 14, density: "comfortable", fontScale: 1, boardWidth: 360, cardVariant: "standard", showHostname: true, showDescription: true, faviconSize: 32, motion: true, wallpaperId: null, wallpaperDim: .2, wallpaperBlur: 0, wallpaperSaturation: 1, wallpaperPosition: "center", wallpaperZoom: 1 },
      privacyPersist: false, privacyEnabled: false, quickSaveMode: "ask", quickSaveDefaultPageId: null, quickSaveDefaultBoardId: null, quickSaveLastPageId: null, quickSaveLastBoardId: null, duplicateStrategy: "warn", trashRetentionDays: 30, recentQueries: [], onboardingComplete: true, updatedAt: timestamp,
    });
    await legacy.table("boards").put({ id: "board", userId: null, pageId: "page", title: "Kept", icon: null, accent: null, position: "hzz", collapsed: false, layout: "grid", createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
    legacy.close();

    const upgraded = new AsterfoldDatabase(name);
    await upgraded.open();
    const settings = await upgraded.settings.get("app");
    const board = await upgraded.boards.get("board");
    expect(settings).toMatchObject({ schemaVersion: 5, locale: "auto", workspaceLayoutMode: "auto", workspaceRows: 2, workspaceAlignment: "center" });
    expect(settings?.theme).toMatchObject({ glassVariant: "regular", backgroundMode: "auto", lowPowerMode: false, bookmarkHoverMotion: true, menuMotion: true, dragMotion: true });
    expect(board).toMatchObject({ title: "Kept", bookmarkColumns: 2, gridColumn: 1, gridRow: 0, gridSpan: 4 });
    upgraded.close();
  });

  it("preserves explicit new-tab behavior while upgrading schema 4", async () => {
    const name = `asterfold-migration-v4-${crypto.randomUUID()}`;
    names.push(name);
    const legacy = new Dexie(name);
    legacy.version(4).stores(V4_STORES);
    await legacy.open();
    const timestamp = "2024-01-01T00:00:00.000Z";
    await legacy.table("settings").put({ id: "app", schemaVersion: 4, updatedAt: timestamp });
    await legacy.table("bookmarks").put({
      id: "bookmark", userId: null, boardId: "board", title: "Kept", url: "https://example.com", normalizedUrl: "https://example.com/", hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: "hzz", openMode: "new-tab", pinned: false,
      createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1,
    });
    legacy.close();

    const upgraded = new AsterfoldDatabase(name);
    await upgraded.open();
    expect(await upgraded.bookmarks.get("bookmark")).toMatchObject({ openMode: "new-tab", version: 1, updatedAt: timestamp });
    expect((await upgraded.settings.get("app"))?.schemaVersion).toBe(CURRENT_DB_SCHEMA_VERSION);
    upgraded.close();
  });

  it.each([1, 2, 3, 4, 5] as const)("upgrades the golden v%s fixture losslessly and reopens idempotently", async (version) => {
    const fixture = JSON.parse(readFileSync(resolve(`tests/fixtures/audit/migrations/db-v${version}.json`), "utf8")) as MigrationFixture;
    const name = `asterfold-golden-v${version}-${crypto.randomUUID()}`;
    names.push(name);
    const legacy = new Dexie(name);
    legacy.version(version).stores(storesByVersion[version]);
    await legacy.open();
    for (const [storeName, records] of Object.entries(fixture.stores)) {
      if (records.length > 0) await legacy.table(storeName).bulkAdd(records);
    }
    legacy.close();

    const upgraded = new AsterfoldDatabase(name);
    await upgraded.open();
    const beforeReopen = {
      pages: await upgraded.pages.toArray(),
      boards: await upgraded.boards.toArray(),
      bookmarks: await upgraded.bookmarks.toArray(),
      settings: await upgraded.settings.toArray(),
    };
    expect(new Set(beforeReopen.bookmarks.map((bookmark) => bookmark.openMode))).toEqual(new Set(["current", "new-tab", "new-window", "incognito"]));
    expect(beforeReopen.pages).toHaveLength(fixture.stores.pages?.length ?? 0);
    expect(beforeReopen.boards).toHaveLength(fixture.stores.boards?.length ?? 0);
    expect(beforeReopen.bookmarks).toHaveLength(fixture.stores.bookmarks?.length ?? 0);
    expect(beforeReopen.settings[0]?.schemaVersion).toBe(CURRENT_DB_SCHEMA_VERSION);
    upgraded.close();
    await upgraded.open();
    expect({
      pages: await upgraded.pages.toArray(),
      boards: await upgraded.boards.toArray(),
      bookmarks: await upgraded.bookmarks.toArray(),
      settings: await upgraded.settings.toArray(),
    }).toEqual(beforeReopen);
    upgraded.close();
  });

  it("rolls back an interrupted migration without wiping v1 records", async () => {
    const name = `asterfold-rollback-${crypto.randomUUID()}`;
    names.push(name);
    const legacy = new Dexie(name);
    legacy.version(1).stores(V1_STORES);
    await legacy.open();
    const original = { id: "app", schemaVersion: 1, updatedAt: "2024-01-01T00:00:00.000Z" };
    await legacy.table("settings").put(original);
    legacy.close();

    const brokenUpgrade = new Dexie(name);
    brokenUpgrade.version(1).stores(V1_STORES);
    brokenUpgrade.version(2).stores(V2_STORES).upgrade(async (transaction) => {
      await migrateToV2(transaction);
      throw new Error("injected migration failure");
    });
    await expect(brokenUpgrade.open()).rejects.toThrow("injected migration failure");
    brokenUpgrade.close();

    const verifier = new Dexie(name);
    verifier.version(1).stores(V1_STORES);
    await verifier.open();
    expect(await verifier.table("settings").get("app")).toEqual(original);
    verifier.close();
  });
});
