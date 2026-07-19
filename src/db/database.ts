import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Board,
  Bookmark,
  DiagnosticEvent,
  Page,
  Snapshot,
  SyncOperation,
  SyncState,
  Wallpaper,
} from "../domain/models";
import { migrateToV2, migrateToV3, V1_STORES, V2_STORES, V3_STORES } from "./migrations";

export class AsterfoldDatabase extends Dexie {
  public pages!: EntityTable<Page, "id">;
  public boards!: EntityTable<Board, "id">;
  public bookmarks!: EntityTable<Bookmark, "id">;
  public settings!: EntityTable<AppSettings, "id">;
  public wallpapers!: EntityTable<Wallpaper, "id">;
  public syncOperations!: EntityTable<SyncOperation, "id">;
  public syncState!: EntityTable<SyncState, "id">;
  public snapshots!: EntityTable<Snapshot, "id">;
  public diagnostics!: EntityTable<DiagnosticEvent, "id">;

  public constructor(name = "asterfold") {
    super(name);
    this.version(1).stores(V1_STORES);
    this.version(2).stores(V2_STORES).upgrade(migrateToV2);
    this.version(3).stores(V3_STORES).upgrade(migrateToV3);

    this.on("versionchange", () => {
      this.close();
    });
  }
}

export const db = new AsterfoldDatabase();
