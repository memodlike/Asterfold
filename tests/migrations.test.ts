import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { CURRENT_DB_SCHEMA_VERSION, V1_STORES, V2_STORES } from "../src/db/migrations";

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
    expect(settings).toMatchObject({ schemaVersion: 4, locale: "auto", workspaceLayoutMode: "auto", workspaceRows: 2, workspaceAlignment: "center" });
    expect(settings?.theme).toMatchObject({ glassVariant: "regular", backgroundMode: "auto", lowPowerMode: false, bookmarkHoverMotion: true, menuMotion: true, dragMotion: true });
    expect(board).toMatchObject({ title: "Kept", bookmarkColumns: 2, gridColumn: 1, gridRow: 0, gridSpan: 4 });
    upgraded.close();
  });
});
