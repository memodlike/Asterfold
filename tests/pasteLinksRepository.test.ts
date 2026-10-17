import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { auditInvariants, bulkDeleteBookmarks, createBookmark, createBookmarksBulk, ensureStarterWorkspace, getWorkspaceData, softDeleteBookmark } from "../src/db/repository";
import { IMPORT_LIMITS } from "../src/domain/importLimits";

describe("bulk pasted bookmarks", () => {
  let database: AsterfoldDatabase;
  let boardId: string;
  beforeEach(async () => {
    database = new AsterfoldDatabase(`paste-${crypto.randomUUID()}`);
    boardId = (await ensureStarterWorkspace(database)).boards[0]!.id;
  });
  afterEach(async () => { vi.restoreAllMocks(); await database.delete(); });

  it("appends normalized unique bookmarks in one transaction and supports exact Undo", async () => {
    const original = await createBookmark({ boardId, title: "", url: "https://example.com" }, {}, database);
    const transaction = vi.spyOn(database, "transaction");
    const added = await createBookmarksBulk(boardId, [{ url: "https://example.com/#x" }, { url: "https://github.com/?utm_source=a" }, { url: "https://github.com" }, { url: "http://example.org", title: "Personal" }], database);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(added.map((item) => item.title)).toEqual(["GitHub", "Personal"]);
    expect(added[0]?.normalizedUrl).toBe("https://github.com/");
    expect((await getWorkspaceData(database)).bookmarks.map((item) => item.id)).toEqual([original.id, ...added.map((item) => item.id)]);
    expect(await auditInvariants(database)).toEqual([]);
    await bulkDeleteBookmarks(added.map((item) => item.id), database);
    expect((await getWorkspaceData(database)).bookmarks.map((item) => item.id)).toEqual([original.id]);
  });
  it("allows a link from Trash and returns no records for an all-duplicate batch", async () => {
    const original = await createBookmark({ boardId, title: "", url: "https://example.com" }, {}, database);
    expect(await createBookmarksBulk(boardId, [{ url: original.url }], database)).toEqual([]);
    await softDeleteBookmark(original.id, database);
    expect(await createBookmarksBulk(boardId, [{ url: original.url }], database)).toHaveLength(1);
  });
  it("rejects unsafe links and oversized batches without partial writes", async () => {
    for (const url of ["javascript:alert(1)", "data:text/html,abc", "file:///secret", "mailto:a@example.com"]) {
      await expect(createBookmarksBulk(boardId, [{ url: "https://good.example" }, { url }], database)).rejects.toThrow();
    }
    await expect(createBookmarksBulk(boardId, Array.from({ length: 201 }, (_, i) => ({ url: `https://example.com/${i}` })), database)).rejects.toThrow();
    expect(await database.bookmarks.count()).toBe(0);
  });
  it("enforces the workspace import bound before inserting", async () => {
    vi.spyOn(database.bookmarks, "count").mockResolvedValue(IMPORT_LIMITS.bookmarks);
    await expect(createBookmarksBulk(boardId, [{ url: "https://example.com" }], database)).rejects.toThrow();
    expect(await database.bookmarks.toArray()).toEqual([]);
  });
  it("rejects deleted or missing boards", async () => {
    await expect(createBookmarksBulk("missing", [{ url: "https://example.com" }], database)).rejects.toThrow();
    await database.boards.update(boardId, { deletedAt: new Date().toISOString() });
    await expect(createBookmarksBulk(boardId, [{ url: "https://example.com" }], database)).rejects.toThrow();
  });
  it("rolls back an insertion failure including ordering repairs", async () => {
    const original = await createBookmark({ boardId, title: "", url: "https://example.com" }, {}, database);
    await database.bookmarks.update(original.id, { position: "zzzzzzzzzzzy" });
    let inserts = 0;
    const fail = () => { inserts += 1; if (inserts === 2) throw new Error("Storage failed"); };
    database.bookmarks.hook("creating", fail);
    await expect(createBookmarksBulk(boardId, [{ url: "https://github.com" }, { url: "https://example.org" }], database)).rejects.toThrow("Storage failed");
    database.bookmarks.hook("creating").unsubscribe(fail);
    expect(await database.bookmarks.toArray()).toEqual([{ ...original, position: "zzzzzzzzzzzy" }]);
  });
});
