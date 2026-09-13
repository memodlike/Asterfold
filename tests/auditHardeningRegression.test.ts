import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { createPage, ensureStarterWorkspace, moveBoardToIndex } from "../src/db/repository";
import { parseNetscapeHtml } from "../src/services/exportImport";

describe("audit hardening regressions", () => {
  let database: AsterfoldDatabase;

  beforeEach(async () => {
    database = new AsterfoldDatabase(`asterfold-audit-${crypto.randomUUID()}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it("keeps Quick Save page/Board pairs coherent when a referenced Board moves", async () => {
    const workspace = await ensureStarterWorkspace(database);
    const sourcePage = workspace.pages[0]!;
    const board = workspace.boards[0]!;
    const targetPage = await createPage("Target", {}, database);
    await database.settings.update("app", {
      quickSaveDefaultPageId: sourcePage.id,
      quickSaveDefaultBoardId: board.id,
      quickSaveLastPageId: sourcePage.id,
      quickSaveLastBoardId: board.id,
    });

    await moveBoardToIndex(board.id, targetPage.id, Number.MAX_SAFE_INTEGER, database);

    expect(await database.settings.get("app")).toMatchObject({
      quickSaveDefaultPageId: targetPage.id,
      quickSaveDefaultBoardId: board.id,
      quickSaveLastPageId: targetPage.id,
      quickSaveLastBoardId: board.id,
    });
  });

  it("decodes malformed numeric bookmark entities without throwing RangeError", () => {
    const records = parseNetscapeHtml('<DL><p><DT><A HREF="https://example.com/">&#999999999999;</A><DD>&#xD800;</DD></DL><p>');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ title: "�", description: "�", url: "https://example.com/" });
  });

  it("keeps runtime message sender validation fail-closed", async () => {
    const background = await readFile(join(process.cwd(), "entrypoints", "background.ts"), "utf8");
    expect(background).toContain("if (sender.id !== chrome.runtime.id) {");
    expect(background).not.toContain("sender.id !== undefined && sender.id !== chrome.runtime.id");
  });

  it("does not retain one-off version-specific release automation", async () => {
    const ci = await readFile(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).not.toContain("publish-release-3-1-4");
    expect(ci).not.toContain("Asterfold 3.1.4 as Latest");
  });
});
