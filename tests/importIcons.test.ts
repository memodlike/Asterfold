import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { ensureStarterWorkspace, getWorkspaceData, updateBookmark } from "../src/db/repository";
import { createBackup, importRecords, parseNetscapeHtml, toNetscapeHtml } from "../src/services/exportImport";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7S8AAAAASUVORK5CYII=";

function chromeExport(icon: string): string {
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<DL><p>",
    "  <DT><H3 PERSONAL_TOOLBAR_FOLDER=\"true\">Bookmarks bar</H3>",
    "  <DL><p>",
    `    <DT><A HREF="https://github.com/" ADD_DATE="1700000000" ICON="${icon}">GitHub</A>`,
    "    <DT><A HREF=\"https://example.com/\" ADD_DATE=\"1700000000\">No icon</A>",
    "    <DT><A HREF=\"https://remote.example/\" ICON_URI=\"https://tracker.invalid/i.png\" ICON=\"https://tracker.invalid/i.png\">Remote</A>",
    "    <DT><A HREF=\"https://svg.example/\" ICON=\"data:image/svg+xml;base64,PHN2Zy8+\">Vector</A>",
    "  </DL><p>",
    "</DL><p>",
  ].join("\n");
}

describe("icons carried by a browser bookmark export", () => {
  let database: AsterfoldDatabase;
  beforeEach(async () => {
    database = new AsterfoldDatabase(`import-icons-${String(Date.now())}-${String(Math.random())}`);
    await ensureStarterWorkspace(database);
  });
  afterEach(async () => {
    await database.delete();
  });

  it("keeps only small validated raster icons from the file", () => {
    const records = parseNetscapeHtml(chromeExport(PNG));
    expect(records.map((record) => record.title)).toEqual(["GitHub", "No icon", "Remote", "Vector"]);
    expect(records[0]?.icon).toBe(PNG);
    expect(records[1]?.icon).toBeUndefined();
    expect(records[2]?.icon, "a remote address is never an icon").toBeUndefined();
    expect(records[3]?.icon, "vector data is not accepted").toBeUndefined();

    const oversized = `data:image/png;base64,${"iVBORw0KGgo".repeat(3_000)}`;
    expect(parseNetscapeHtml(chromeExport(oversized))[0]?.icon, "far larger than a favicon").toBeUndefined();
  });

  it("stores the icon with the bookmark, re-validates it on import and exports it again", async () => {
    const records = parseNetscapeHtml(chromeExport(PNG));
    records.push({ title: "Forged", url: "https://forged.example/", description: null, folderPath: [], icon: "javascript:alert(1)" });
    await importRecords(records, { pageTitle: "Imported" }, "allow", database);

    const workspace = await getWorkspaceData(database);
    const byTitle = new Map(workspace.bookmarks.map((bookmark) => [bookmark.title, bookmark]));
    expect(byTitle.get("GitHub")?.customIcon).toBe(PNG);
    expect(byTitle.get("No icon")?.customIcon).toBeNull();
    expect(byTitle.get("Forged")?.customIcon).toBeNull();
    expect(workspace.bookmarks.every((bookmark) => bookmark.faviconUrl === null)).toBe(true);

    const html = toNetscapeHtml(await createBackup({}, database));
    expect(html).toContain(`<A HREF="https://github.com/" ADD_DATE="`);
    expect(html).toContain(`ICON="${PNG}">GitHub</A>`);
    expect(html.match(/ICON="/gu)).toHaveLength(1);
    expect(parseNetscapeHtml(html).find((record) => record.title === "GitHub")?.icon).toBe(PNG);
  });

  it("drops a stored icon when the bookmark moves to another site and keeps it otherwise", async () => {
    await importRecords(parseNetscapeHtml(chromeExport(PNG)), { pageTitle: "Imported" }, "allow", database);
    const github = (await getWorkspaceData(database)).bookmarks.find((bookmark) => bookmark.title === "GitHub")!;

    const renamed = await updateBookmark(github.id, { title: "GitHub home", url: "https://github.com/explore" }, database);
    expect(renamed.customIcon).toBe(PNG);
    const moved = await updateBookmark(github.id, { url: "https://gitlab.com/" }, database);
    expect(moved.customIcon).toBeNull();
  });
});
