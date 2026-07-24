import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureRoot = join(process.cwd(), "tests/fixtures/audit");
const openModes = ["current", "new-tab", "new-window", "incognito"];

interface FixtureBookmark {
  openMode: string;
  deletedAt: string | null;
  position: string;
}

interface AuditFixture {
  fixtureFormat: number;
  dbVersion: number;
  stores: {
    bookmarks: FixtureBookmark[];
    settings: Array<Record<string, unknown>>;
    pages: Array<{ deletedAt: string | null }>;
    boards: Array<{ deletedAt: string | null }>;
    wallpapers: Array<Record<string, unknown>>;
    syncOperations: Array<Record<string, unknown>>;
    syncState: Array<Record<string, unknown>>;
  };
}

interface GoldenBackup {
  exportVersion: number;
  entities: { bookmarks: Array<{ openMode: string }> };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(fixtureRoot, path), "utf8")) as T;
}

describe("hardening audit fixtures", () => {
  it("provides deterministic database fixtures for schema versions 1 through 5", async () => {
    const fixtures = await Promise.all(
      Array.from({ length: 5 }, (_, index) => readJson<AuditFixture>(`migrations/db-v${index + 1}.json`)),
    );

    expect(fixtures.map((fixture) => fixture.dbVersion)).toEqual([1, 2, 3, 4, 5]);
    for (const fixture of fixtures) {
      expect(fixture.fixtureFormat).toBe(1);
      expect(new Set(fixture.stores.bookmarks.map((bookmark) => bookmark.openMode))).toEqual(new Set(openModes));
    }
  });

  it("covers scale, stale references, deletion, wallpaper, rank corruption, and outbox state", async () => {
    const fixture = await readJson<AuditFixture>("migrations/db-v5.json");
    const activeBookmarks = fixture.stores.bookmarks.filter((bookmark) => bookmark.deletedAt === null);

    expect(activeBookmarks).toHaveLength(100);
    expect(fixture.stores.settings[0]).toMatchObject({
      quickSaveDefaultPageId: "page-missing",
      quickSaveDefaultBoardId: "board-missing",
      quickSaveLastPageId: "page-deleted",
      quickSaveLastBoardId: "board-deleted",
    });
    expect(fixture.stores.pages.some((page) => page.deletedAt !== null)).toBe(true);
    expect(fixture.stores.boards.some((board) => board.deletedAt !== null)).toBe(true);
    expect(fixture.stores.wallpapers[0]).toMatchObject({ kind: "upload", mimeType: "image/webp" });
    expect(fixture.stores.bookmarks.some((bookmark) => bookmark.position === "corrupt-rank")).toBe(true);
    expect(new Set(fixture.stores.bookmarks.map((bookmark) => bookmark.position)).size).toBeLessThan(fixture.stores.bookmarks.length);
    expect(fixture.stores.syncOperations).toHaveLength(1);
    expect(fixture.stores.syncState[0]).toMatchObject({ status: "offline", cursor: 42 });
  });

  it("exports v1 and v2 golden backups with all bookmark open modes intact", async () => {
    const backups = await Promise.all([1, 2].map((version) => readJson<GoldenBackup>(`backups/backup-v${version}-golden.json`)));

    expect(backups.map((backup) => backup.exportVersion)).toEqual([1, 2]);
    for (const backup of backups) {
      expect(new Set(backup.entities.bookmarks.map((bookmark) => bookmark.openMode))).toEqual(new Set(openModes));
    }
  });
});
