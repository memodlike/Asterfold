import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { createBookmark, ensureStarterWorkspace, getWorkspaceData } from "../src/db/repository";
import {
  createBackup,
  importRecords,
  parseBackup,
  parseNetscapeHtml,
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
  });

  it("rejects prototype pollution keys and unsafe imported URLs", () => {
    expect(() => parseBackup('{"__proto__":{"polluted":true}}')).toThrow(/unsafe object key/u);
    const records = parseNetscapeHtml('<DL><p><DT><A HREF="javascript:alert(1)">Bad</A><DT><A HREF="https://safe.example">Safe</A></DL><p>');
    expect(records).toHaveLength(1);
    expect(records[0]?.url).toBe("https://safe.example");
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
    expect(normalized.settings).toMatchObject({ schemaVersion: 4, locale: "auto", workspaceLayoutMode: "auto", workspaceRows: 2, workspaceAlignment: "center" });
    expect(normalized.settings?.theme).toMatchObject({ lowPowerMode: false, bookmarkHoverMotion: true, menuMotion: true, dragMotion: true });
    expect(normalized.entities.boards[0]).toMatchObject({ bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3 });
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
