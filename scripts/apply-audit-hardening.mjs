import { readFile, writeFile, unlink } from "node:fs/promises";

async function patchFile(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch made no change`);
  await writeFile(path, after, "utf8");
}

await patchFile("entrypoints/background.ts", (source) => {
  const from = "if (sender.id !== undefined && sender.id !== chrome.runtime.id) {";
  const to = "if (sender.id !== chrome.runtime.id) {";
  if (!source.includes(from)) throw new Error("background sender guard not found");
  return source.replace(from, to);
});

await patchFile("src/db/repository.ts", (source) => {
  const start = source.indexOf("export async function moveBoardToIndex(");
  const endMarker = "\n}\n\nexport async function duplicateBoard";
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error("moveBoardToIndex block not found");

  let block = source.slice(start, end + 2);
  const transactionFrom = 'await database.transaction("rw", database.pages, database.boards, async () => {';
  const transactionTo = 'await database.transaction("rw", [database.pages, database.boards, database.settings], async () => {';
  if (!block.includes(transactionFrom)) throw new Error("moveBoardToIndex transaction signature not found");
  block = block.replace(transactionFrom, transactionTo);

  const close = block.lastIndexOf("\n  });\n}");
  if (close < 0) throw new Error("moveBoardToIndex transaction close not found");
  const repair = `\n    const settings = await database.settings.get("app");\n    if (settings) {\n      const settingsPatch: Partial<AppSettings> = {};\n      if (settings.quickSaveDefaultBoardId === id && settings.quickSaveDefaultPageId !== targetPageId) {\n        settingsPatch.quickSaveDefaultPageId = targetPageId;\n      }\n      if (settings.quickSaveLastBoardId === id && settings.quickSaveLastPageId !== targetPageId) {\n        settingsPatch.quickSaveLastPageId = targetPageId;\n      }\n      if (Object.keys(settingsPatch).length > 0) {\n        await database.settings.update("app", { ...settingsPatch, updatedAt: timestamp });\n      }\n    }`;
  block = block.slice(0, close) + repair + block.slice(close);
  return source.slice(0, start) + block + source.slice(end + 2);
});

await patchFile("src/services/exportImport.ts", (source) => {
  const start = source.indexOf("  const decode = (value: string): string =>");
  const end = source.indexOf("  const finishDescription = (): void =>", start);
  if (start < 0 || end < 0) throw new Error("Netscape entity decoder block not found");
  const replacement = `  const decodeCodePoint = (raw: string, radix: 10 | 16): string => {\n    const point = Number.parseInt(raw, radix);\n    if (!Number.isSafeInteger(point) || point <= 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) {\n      return "\\uFFFD";\n    }\n    return String.fromCodePoint(point);\n  };\n  const decode = (value: string): string => value\n    .replace(/&#(\\d+);/gu, (_, code: string) => decodeCodePoint(code, 10))\n    .replace(/&#x([\\da-f]+);/giu, (_, code: string) => decodeCodePoint(code, 16))\n    .replaceAll("&quot;", "\\\"").replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");\n`;
  return source.slice(0, start) + replacement + source.slice(end);
});

const regressionTest = `import { readFile } from "node:fs/promises";\nimport { join } from "node:path";\nimport { afterEach, beforeEach, describe, expect, it } from "vitest";\nimport { AsterfoldDatabase } from "../src/db/database";\nimport { createPage, ensureStarterWorkspace, moveBoardToIndex } from "../src/db/repository";\nimport { parseNetscapeHtml } from "../src/services/exportImport";\n\ndescribe("audit hardening regressions", () => {\n  let database: AsterfoldDatabase;\n\n  beforeEach(async () => {\n    database = new AsterfoldDatabase(\`asterfold-audit-\${crypto.randomUUID()}\`);\n    await database.open();\n  });\n\n  afterEach(async () => {\n    await database.delete();\n  });\n\n  it("keeps Quick Save page/Board pairs coherent when a referenced Board moves", async () => {\n    const workspace = await ensureStarterWorkspace(database);\n    const sourcePage = workspace.pages[0]!;\n    const board = workspace.boards[0]!;\n    const targetPage = await createPage("Target", {}, database);\n    await database.settings.update("app", {\n      quickSaveDefaultPageId: sourcePage.id,\n      quickSaveDefaultBoardId: board.id,\n      quickSaveLastPageId: sourcePage.id,\n      quickSaveLastBoardId: board.id,\n    });\n\n    await moveBoardToIndex(board.id, targetPage.id, Number.MAX_SAFE_INTEGER, database);\n\n    expect(await database.settings.get("app")).toMatchObject({\n      quickSaveDefaultPageId: targetPage.id,\n      quickSaveDefaultBoardId: board.id,\n      quickSaveLastPageId: targetPage.id,\n      quickSaveLastBoardId: board.id,\n    });\n  });\n\n  it("decodes malformed numeric bookmark entities without throwing RangeError", () => {\n    const records = parseNetscapeHtml('<DL><p><DT><A HREF="https://example.com/">&#999999999999;</A><DD>&#xD800;</DD></DL><p>');\n    expect(records).toHaveLength(1);\n    expect(records[0]).toMatchObject({ title: "�", description: "�", url: "https://example.com/" });\n  });\n\n  it("keeps runtime message sender validation fail-closed", async () => {\n    const background = await readFile(join(process.cwd(), "entrypoints", "background.ts"), "utf8");\n    expect(background).toContain("if (sender.id !== chrome.runtime.id) {");\n    expect(background).not.toContain("sender.id !== undefined && sender.id !== chrome.runtime.id");\n  });\n\n  it("does not retain one-off version-specific release automation", async () => {\n    const ci = await readFile(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");\n    expect(ci).not.toContain("publish-release-3-1-4");\n    expect(ci).not.toContain("Asterfold 3.1.4 as Latest");\n  });\n});\n`;
await writeFile("tests/auditHardeningRegression.test.ts", regressionTest, "utf8");

for (const path of [".release-3.2.2-execute", ".release-3.2.2-execute-2", "scripts/apply-audit-hardening.mjs"]) {
  await unlink(path).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}
