import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { version as packageVersion } from "../package.json";
import { AsterfoldDatabase } from "../src/db/database";
import { createBookmark, ensureStarterWorkspace, getWorkspaceData, updateSettings } from "../src/db/repository";
import {
  createBackup,
  createSelectionBackup,
  importRecords,
  parseBackup,
  parseNetscapeHtml,
  previewBackup,
  restoreBackup,
  serializeBackup,
  toMarkdown,
  toNetscapeHtml,
} from "../src/services/exportImport";

const webpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function uploadedWallpaper(id = "wallpaper-upload") {
  const blob = new Blob([webpBytes], { type: "image/webp" });
  return {
    id,
    kind: "upload" as const,
    name: "Local wallpaper",
    mimeType: "image/webp",
    blob,
    thumbnail: blob,
    value: null,
    width: 64,
    height: 64,
    sourceBytes: blob.size,
    storedBytes: blob.size * 2,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

async function blobBytes(blob: Blob | null | undefined): Promise<Uint8Array> {
  if (!blob) return new Uint8Array();
  if (typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(new Uint8Array(reader.result as ArrayBuffer)), { once: true });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Blob read failed")), { once: true });
    reader.readAsArrayBuffer(blob);
  });
}

describe("safe import and lossless export", () => {
  let database: AsterfoldDatabase;

  beforeEach(async () => {
    vi.stubGlobal("Blob", NodeBlob);
    database = new AsterfoldDatabase(`asterfold-import-${crypto.randomUUID()}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
    vi.unstubAllGlobals();
  });

  it("round-trips the hierarchy and escapes HTML export", async () => {
    const workspace = await ensureStarterWorkspace(database);
    await createBookmark({
      boardId: workspace.boards[0]!.id,
      title: "<script>alert('x')</script>",
      url: "https://example.com/docs",
      description: "Useful & safe",
    }, {}, database);
    const backup = await createBackup({}, database);
    const parsed = parseBackup(serializeBackup(backup));
    const html = toNetscapeHtml(parsed);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(toMarkdown(parsed)).toContain("https://example.com/docs");

    await database.transaction("rw", database.pages, database.boards, database.bookmarks, async () => {
      await Promise.all([database.bookmarks.clear(), database.boards.clear(), database.pages.clear()]);
    });
    await restoreBackup(parsed, "replace", database);
    const restored = await getWorkspaceData(database);
    expect(restored.pages).toHaveLength(1);
    expect(restored.boards).toHaveLength(1);
    expect(restored.bookmarks).toHaveLength(1);
    expect(restored.bookmarks[0]?.title).toBe("<script>alert('x')</script>");
    const reexported = await createBackup({}, database);
    expect(reexported.entities).toEqual(parsed.entities);
    expect(reexported.settings).toEqual(parsed.settings);
  });

  it("exports backup v3 with the package version and only the active uploaded wallpaper", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const active = uploadedWallpaper();
    await database.wallpapers.bulkAdd([active, uploadedWallpaper("orphan-wallpaper")]);
    await updateSettings({
      theme: { ...workspace.settings.theme, wallpaperId: active.id, backgroundMode: "wallpaper" },
    }, database);

    const backup = await createBackup({}, database);
    expect(backup).toMatchObject({
      schemaVersion: 3,
      exportVersion: 3,
      appVersion: packageVersion,
      assets: {
        wallpapers: [{
          id: active.id,
          kind: "upload",
          mimeType: "image/webp",
          width: 64,
          height: 64,
          sourceBytes: active.sourceBytes,
          storedBytes: active.storedBytes,
        }],
      },
    });
    expect(backup.assets?.wallpapers[0]?.data).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(backup.assets?.wallpapers[0]?.thumbnail).toBe(backup.assets?.wallpapers[0]?.data);
    expect(backup.assets?.wallpapers).toHaveLength(1);

    const scoped = await createBackup({ pageId: workspace.pages[0]!.id }, database);
    expect(scoped.settings).toBeUndefined();
    expect(scoped.assets?.wallpapers).toEqual([]);
  });

  it("creates a valid selection backup with only the selected bookmarks and their ancestors", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const first = await createBookmark({
      boardId: workspace.boards[0]!.id,
      title: "Selected",
      url: "https://selected.example",
    }, {}, database);
    await createBookmark({
      boardId: workspace.boards[0]!.id,
      title: "Not selected",
      url: "https://not-selected.example",
    }, {}, database);

    const backup = await createSelectionBackup([first.id, first.id], database);
    expect(backup.scope).toBe("selection");
    expect(backup.entities.pages.map((page) => page.id)).toEqual([workspace.pages[0]!.id]);
    expect(backup.entities.boards.map((board) => board.id)).toEqual([workspace.boards[0]!.id]);
    expect(backup.entities.bookmarks.map((bookmark) => bookmark.id)).toEqual([first.id]);
    expect(backup.settings).toBeUndefined();
    expect(parseBackup(serializeBackup(backup))).toEqual(backup);
  });

  it("parses and atomically restores a v3 wallpaper backup", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const active = uploadedWallpaper();
    await database.wallpapers.add(active);
    await updateSettings({
      theme: { ...workspace.settings.theme, wallpaperId: active.id, backgroundMode: "wallpaper" },
    }, database);
    const serialized = serializeBackup(await createBackup({}, database));

    await database.wallpapers.clear();
    await updateSettings({
      theme: { ...workspace.settings.theme, wallpaperId: null, backgroundMode: "auto" },
    }, database);
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 64, height: 64, close: vi.fn() })));
    await restoreBackup(parseBackup(serialized), "replace", database);

    const restoredSettings = await database.settings.get("app");
    const restored = await database.wallpapers.get(active.id);
    expect(restoredSettings?.theme.wallpaperId).toBe(active.id);
    expect(restored?.blob).toBeInstanceOf(Blob);
    expect(restored?.thumbnail).toBeInstanceOf(Blob);
    expect(await blobBytes(restored?.blob)).toEqual(await blobBytes(active.blob));

    const reexported = parseBackup(serializeBackup(await createBackup({}, database)));
    expect(reexported.assets).toEqual(parseBackup(serialized).assets);
  });

  it("rejects unsafe or unbounded v3 wallpaper assets", async () => {
    const backup = await createBackup({}, database);
    const encodedWebp = btoa(String.fromCharCode(...webpBytes));
    const wallpaper = {
      id: "wallpaper-upload",
      name: "Wallpaper",
      kind: "upload",
      mimeType: "image/webp",
      width: 64,
      height: 64,
      sourceBytes: webpBytes.length,
      storedBytes: webpBytes.length * 2,
      data: encodedWebp,
      thumbnail: encodedWebp,
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    };
    const withAsset = { ...backup, assets: { wallpapers: [wallpaper] } };

    expect(() => parseBackup(JSON.stringify({
      ...withAsset,
      assets: { wallpapers: [{ ...wallpaper, data: "not base64!" }] },
    }))).toThrow(/validation failed/iu);
    expect(() => parseBackup(JSON.stringify({
      ...withAsset,
      assets: { wallpapers: [{ ...wallpaper, mimeType: "image/svg+xml" }] },
    }))).toThrow(/validation failed/iu);
    expect(() => parseBackup(JSON.stringify({
      ...withAsset,
      assets: { wallpapers: [{ ...wallpaper, data: "https://example.com/wallpaper.webp" }] },
    }))).toThrow(/validation failed/iu);
    expect(() => parseBackup(JSON.stringify({
      ...withAsset,
      assets: { wallpapers: [{ ...wallpaper, data: btoa("<svg></svg>") }] },
    }))).toThrow(/validation failed/iu);
    expect(() => parseBackup(JSON.stringify({
      ...withAsset,
      assets: { wallpapers: [{ ...wallpaper, data: "UklGRg==" }] },
    }))).toThrow(/validation failed/iu);
    expect(() => parseBackup(JSON.stringify({
      ...withAsset,
      assets: { wallpapers: Array.from({ length: 3 }, (_, index) => ({ ...wallpaper, id: `wallpaper-${index}` })) },
    }))).toThrow(/validation failed/iu);
  });

  it("does not mutate the workspace when v3 wallpaper restore validation fails", async () => {
    const existing = await ensureStarterWorkspace(database);
    const source = new AsterfoldDatabase(`asterfold-import-source-${crypto.randomUUID()}`);
    await source.open();
    try {
      const sourceWorkspace = await ensureStarterWorkspace(source);
      const active = uploadedWallpaper();
      await source.wallpapers.add(active);
      await updateSettings({
        theme: { ...sourceWorkspace.settings.theme, wallpaperId: active.id, backgroundMode: "wallpaper" },
      }, source);
      const backup = await createBackup({}, source);
      vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.reject(new Error("decoder failed"))));
      await expect(restoreBackup(backup, "replace", database)).rejects.toThrow(/decoded|decode/iu);
      expect((await database.pages.toArray()).map((page) => page.id)).toEqual(existing.pages.map((page) => page.id));
      expect(await database.wallpapers.count()).toBe(0);
    } finally {
      await source.delete();
    }
  });

  it("rolls back entity and wallpaper writes together when replace restore fails", async () => {
    const existing = await ensureStarterWorkspace(database);
    const source = new AsterfoldDatabase(`asterfold-import-rollback-${crypto.randomUUID()}`);
    await source.open();
    try {
      const sourceWorkspace = await ensureStarterWorkspace(source);
      const active = uploadedWallpaper();
      await source.wallpapers.add(active);
      await updateSettings({
        theme: { ...sourceWorkspace.settings.theme, wallpaperId: active.id, backgroundMode: "wallpaper" },
      }, source);
      const backup = await createBackup({}, source);
      vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 64, height: 64, close: vi.fn() })));
      vi.spyOn(database.wallpapers, "bulkPut").mockRejectedValueOnce(new Error("injected wallpaper write failure"));

      await expect(restoreBackup(backup, "replace", database)).rejects.toThrow(/injected wallpaper write failure/u);
      expect((await database.pages.toArray()).map((page) => page.id)).toEqual(existing.pages.map((page) => page.id));
      expect(await database.wallpapers.count()).toBe(0);
    } finally {
      await source.delete();
    }
  });

  it("rejects prototype pollution keys and unsafe imported URLs", () => {
    expect(() => parseBackup('{"__proto__":{"polluted":true}}')).toThrow(/unsafe object key/u);
    const records = parseNetscapeHtml('<DL><p><DT><A HREF="javascript:alert(1)">Bad</A><DT><A HREF="https://%75ser@example.com/private">Credentials</A><DT><A HREF="https://safe.example">Safe</A></DL><p>');
    expect(records).toHaveLength(1);
    expect(records[0]?.url).toBe("https://safe.example");
  });

  it("rejects unknown backup format versions without attempting repair", async () => {
    const backup = await createBackup({}, database);
    const malformed = { ...backup, schemaVersion: 99, exportVersion: 99 };
    expect(() => parseBackup(JSON.stringify(malformed))).toThrow(/validation failed/iu);
  });

  it("rejects unknown fields, duplicate IDs, orphaned children, and invalid ranks", async () => {
    const backup = await createBackup({}, database);
    expect(() => parseBackup(JSON.stringify({ ...backup, unexpected: true }))).toThrow(/validation failed/iu);

    const duplicate = structuredClone(backup);
    duplicate.entities.pages.push(structuredClone(duplicate.entities.pages[0]!));
    expect(() => parseBackup(JSON.stringify(duplicate))).toThrow(/duplicate/iu);

    const orphan = structuredClone(backup);
    orphan.entities.boards[0]!.pageId = "missing-page";
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow(/parent/iu);

    const invalidRank = structuredClone(backup);
    invalidRank.entities.boards[0]!.position = "broken";
    expect(() => parseBackup(JSON.stringify(invalidRank))).toThrow(/rank/iu);
  });

  it("imports backup v1 and v2 payloads without requiring assets", async () => {
    const backup = await createBackup({}, database);
    const legacy = JSON.parse(serializeBackup(backup)) as Record<string, unknown> & { entities: { boards: Array<Record<string, unknown>> }; settings: Record<string, unknown>; theme: Record<string, unknown> };
    legacy.schemaVersion = 1;
    legacy.exportVersion = 1;
    delete legacy.assets;
    for (const board of legacy.entities.boards) {
      delete board.bookmarkColumns;
      delete board.gridColumn;
      delete board.gridRow;
      delete board.gridSpan;
    }
    delete legacy.settings.locale;
    delete legacy.settings.workspaceLayoutMode;
    delete legacy.settings.workspaceRows;
    delete legacy.settings.workspaceAlignment;
    delete (legacy.settings.theme as Record<string, unknown>).glassVariant;
    delete (legacy.settings.theme as Record<string, unknown>).backgroundMode;
    delete (legacy.settings.theme as Record<string, unknown>).lowPowerMode;
    delete (legacy.settings.theme as Record<string, unknown>).bookmarkHoverMotion;
    delete (legacy.settings.theme as Record<string, unknown>).menuMotion;
    delete (legacy.settings.theme as Record<string, unknown>).dragMotion;
    delete legacy.theme.glassVariant;
    delete legacy.theme.backgroundMode;
    delete legacy.theme.lowPowerMode;
    delete legacy.theme.bookmarkHoverMotion;
    delete legacy.theme.menuMotion;
    delete legacy.theme.dragMotion;
    const normalized = parseBackup(JSON.stringify(legacy));
    expect(normalized).toMatchObject({ schemaVersion: 1, exportVersion: 1 });
    expect(normalized.settings).toMatchObject({ schemaVersion: 5, locale: "auto", workspaceLayoutMode: "auto", workspaceRows: 2, workspaceAlignment: "center" });
    expect(normalized.settings?.theme).toMatchObject({ lowPowerMode: false, bookmarkHoverMotion: true, menuMotion: true, dragMotion: true });
    expect(normalized.entities.boards[0]).toMatchObject({ bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3 });

    const v2 = { ...backup, schemaVersion: 2, exportVersion: 2 };
    delete (v2 as { assets?: unknown }).assets;
    expect(parseBackup(JSON.stringify(v2))).toMatchObject({ schemaVersion: 2, exportVersion: 2 });
  });

  it("preserves every explicit open mode through export and parse", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const modes = ["current", "new-tab", "new-window", "incognito"] as const;
    for (const [index, openMode] of modes.entries()) {
      await createBookmark({
        boardId: workspace.boards[0]!.id,
        title: `Example ${openMode}`,
        url: `https://example.com/${index}`,
        openMode,
      }, {}, database);
    }
    const backup = await createBackup({}, database);
    const parsed = parseBackup(serializeBackup(backup));
    expect(Object.fromEntries(parsed.entities.bookmarks.map((bookmark) => [bookmark.title, bookmark.openMode]))).toEqual({
      "Example current": "current",
      "Example new-tab": "new-tab",
      "Example new-window": "new-window",
      "Example incognito": "incognito",
    });
    expect(parseBackup(serializeBackup(parsed))).toEqual(parsed);
  });

  it("previews destructive scope and remaps external merge identities", async () => {
    const original = await createBackup({}, database);
    const { backup, preview } = previewBackup(serializeBackup(original), "replace");
    expect(preview).toMatchObject({
      valid: { pages: 1, boards: 1, bookmarks: 0 },
      invalid: 0,
      destructiveScope: "workspace",
    });
    await restoreBackup(backup, "merge", database);
    const merged = await getWorkspaceData(database);
    expect(merged.pages).toHaveLength(2);
    expect(new Set(merged.pages.map((page) => page.id)).size).toBe(2);
    expect(merged.boards).toHaveLength(2);
    expect(new Set(merged.boards.map((board) => board.id)).size).toBe(2);
  });

  it("remaps deleted batches and produces unique ranks when merging", async () => {
    const destination = await ensureStarterWorkspace(database);
    const destinationBookmark = await createBookmark({
      boardId: destination.boards[0]!.id,
      title: "Destination deleted",
      url: "https://destination.example",
    }, {}, database);
    await database.bookmarks.update(destinationBookmark.id, {
      deletedAt: "2026-07-26T00:00:00.000Z",
      deletedBatchId: "shared-external-batch",
    });

    const source = new AsterfoldDatabase(`asterfold-merge-source-${crypto.randomUUID()}`);
    await source.open();
    try {
      const sourceWorkspace = await ensureStarterWorkspace(source);
      const sourceBookmark = await createBookmark({
        boardId: sourceWorkspace.boards[0]!.id,
        title: "Source deleted",
        url: "https://source.example",
      }, {}, source);
      await source.transaction("rw", source.boards, source.bookmarks, async () => {
        await source.boards.update(sourceWorkspace.boards[0]!.id, {
          deletedAt: "2026-07-26T00:00:00.000Z",
          deletedBatchId: "shared-external-batch",
        });
        await source.bookmarks.update(sourceBookmark.id, {
          deletedAt: "2026-07-26T00:00:00.000Z",
          deletedBatchId: "shared-external-batch",
        });
      });
      const sourceBackup = await createBackup({}, source);
      await restoreBackup(sourceBackup, "merge", database);

      const importedPage = (await database.pages.toArray()).find((page) => page.id !== destination.pages[0]!.id)!;
      const importedBoard = (await database.boards.toArray()).find((board) => board.pageId === importedPage.id)!;
      const importedBookmark = (await database.bookmarks.toArray()).find((bookmark) => bookmark.boardId === importedBoard.id)!;
      expect(importedBoard.deletedBatchId).toBeTruthy();
      expect(importedBoard.deletedBatchId).not.toBe("shared-external-batch");
      expect(importedBookmark.deletedBatchId).toBe(importedBoard.deletedBatchId);
      expect((await database.bookmarks.get(destinationBookmark.id))?.deletedBatchId).toBe("shared-external-batch");

      const pageRanks = (await database.pages.toArray()).map((page) => page.position);
      expect(new Set(pageRanks).size).toBe(pageRanks.length);
    } finally {
      await source.delete();
    }
  });

  it("clears dangling uploaded wallpaper references in legacy backups", async () => {
    const backup = await createBackup({}, database);
    const legacy = structuredClone(backup);
    legacy.schemaVersion = 2;
    legacy.exportVersion = 2;
    delete (legacy as { assets?: unknown }).assets;
    legacy.settings!.theme = {
      ...legacy.settings!.theme,
      wallpaperId: "missing-upload",
      backgroundMode: "wallpaper",
    };
    legacy.theme = legacy.settings!.theme;

    const parsed = parseBackup(JSON.stringify(legacy));
    expect(parsed.settings?.theme).toMatchObject({
      wallpaperId: null,
      backgroundMode: "auto",
    });
  });

  it("reports invalid rows and skips normalized duplicates", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const records = [
      { title: "Spec", url: "https://example.com/spec?utm_source=a", description: null, folderPath: ["Engineering"] },
      { title: "Unsafe", url: "javascript:alert(1)", description: null, folderPath: ["Engineering"] },
    ];
    const first = await importRecords(records, { pageTitle: "Ignored", pageId: workspace.pages[0]!.id }, "skip", database);
    expect(first).toEqual({ imported: 1, skippedDuplicates: 0, invalid: [{ row: 2, reason: "This URL scheme is not allowed" }] });
    const second = await importRecords(records.slice(0, 1), { pageTitle: "Ignored", pageId: workspace.pages[0]!.id }, "skip", database);
    expect(second).toMatchObject({ imported: 0, skippedDuplicates: 1, invalid: [] });
  });

  it("imports 10,000 Unicode bookmarks in bounded bulk transactions", async () => {
    const records = Array.from({ length: 10_000 }, (_, index) => ({
      title: `Зерттеу · Исследование · Research ${index}`,
      url: `https://dataset.example/items/${index}`,
      description: `Қазақша · Русский · English ${index}`,
      folderPath: [`Collection ${index % 20}`],
    }));
    const started = performance.now();
    const summary = await importRecords(records, { pageTitle: "Large import" }, "skip", database);
    const elapsed = performance.now() - started;
    console.info(`PERF import_10k_ms=${elapsed.toFixed(2)}`);
    expect(summary).toEqual({ imported: 10_000, skippedDuplicates: 0, invalid: [] });
    expect(await database.bookmarks.count()).toBe(10_000);
    expect(await database.boards.count()).toBe(21);
    expect(elapsed).toBeLessThan(10_000);
  }, 15_000);
});
