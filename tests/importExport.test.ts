import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { createBookmark, ensureStarterWorkspace, getWorkspaceData } from "../src/db/repository";
import {
  createBackup,
  importRecords,
  parseBackup,
  parseNetscapeHtml,
  previewBackup,
  restoreBackup,
  serializeBackup,
  toMarkdown,
  toNetscapeHtml,
} from "../src/services/exportImport";

describe("safe import and lossless export", () => {
  let database: AsterfoldDatabase;

  beforeEach(async () => {
    database = new AsterfoldDatabase(`asterfold-import-${crypto.randomUUID()}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
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

  it("normalizes a backup v1 payload to backup v2 defaults", async () => {
    const backup = await createBackup({}, database);
    const legacy = JSON.parse(serializeBackup(backup)) as Record<string, unknown> & { entities: { boards: Array<Record<string, unknown>> }; settings: Record<string, unknown>; theme: Record<string, unknown> };
    legacy.schemaVersion = 1;
    legacy.exportVersion = 1;
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
    expect(normalized).toMatchObject({ schemaVersion: 2, exportVersion: 2 });
    expect(normalized.settings).toMatchObject({ schemaVersion: 5, locale: "auto", workspaceLayoutMode: "auto", workspaceRows: 2, workspaceAlignment: "center" });
    expect(normalized.settings?.theme).toMatchObject({ lowPowerMode: false, bookmarkHoverMotion: true, menuMotion: true, dragMotion: true });
    expect(normalized.entities.boards[0]).toMatchObject({ bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3 });
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
