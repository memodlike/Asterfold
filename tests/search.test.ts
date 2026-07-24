import { describe, expect, it } from "vitest";
import { BookmarkSearchEngine, type SearchDocument } from "../src/search/searchEngine";

function document(id: string, overrides: Partial<SearchDocument> = {}): SearchDocument {
  return {
    id,
    title: `Bookmark ${id}`,
    url: `https://example.com/${id}`,
    hostname: "example.com",
    description: "",
    pageTitle: "Workspace",
    boardTitle: "Inbox",
    pageId: "page-1",
    boardId: "board-1",
    ...overrides,
  };
}

describe("bookmark search", () => {
  it("ranks title matches over description matches and supports fuzzy text", () => {
    const engine = new BookmarkSearchEngine([
      document("title", { title: "Architecture guide" }),
      document("description", { title: "Weekly notes", description: "Architecture guide" }),
      document("fuzzy", { title: "Product design system" }),
    ]);
    expect(engine.search("architecture", { mode: "fuzzy", field: "all" }).map((item) => item.id)).toEqual([
      "title",
      "description",
    ]);
    expect(engine.search("desgin", { mode: "fuzzy", field: "all" })[0]?.id).toBe("fuzzy");
  });

  it("supports exact, field, Page, and Board scopes", () => {
    const engine = new BookmarkSearchEngine([
      document("one", { title: "Launch brief", pageId: "p1", boardId: "b1" }),
      document("two", { title: "Launch brief", pageId: "p2", boardId: "b2", url: "https://launch.example/two" }),
    ]);
    expect(engine.search("launch brief", { mode: "exact", field: "title", pageId: "p2" }).map((item) => item.id)).toEqual(["two"]);
    expect(engine.search("launch.example", { mode: "prefix", field: "url", boardId: "b2" }).map((item) => item.id)).toEqual(["two"]);
  });

  it("normalizes Unicode, bounds query length, and caps the result count", () => {
    const engine = new BookmarkSearchEngine(Array.from({ length: 200 }, (_, index) => document(String(index), {
      title: `Café reference ${index}`,
    })));
    expect(engine.search("Cafe\u0301", { mode: "exact", field: "title", limit: 500 })).toHaveLength(100);
    expect(engine.search("x".repeat(257), { mode: "fuzzy", field: "all" })).toEqual([]);
  });

  it("queries a 10,000-bookmark index within the interaction budget", () => {
    const documents = Array.from({ length: 10_000 }, (_, index) => document(String(index), {
      title: index === 9_721 ? "Unique Kazakhstan research atlas" : `Reference item ${index}`,
      description: `Русский қазақша English note ${index}`,
      pageId: `page-${index % 8}`,
      boardId: `board-${index % 64}`,
    }));
    const indexStarted = performance.now();
    const engine = new BookmarkSearchEngine(documents);
    const indexElapsed = performance.now() - indexStarted;
    const started = performance.now();
    const result = engine.search("Kazakhstan atlas", { mode: "fuzzy", field: "all" });
    const elapsed = performance.now() - started;
    console.info(`PERF search_10k_index_ms=${indexElapsed.toFixed(2)} search_10k_query_ms=${elapsed.toFixed(2)}`);
    expect(result[0]?.id).toBe("9721");
    expect(elapsed).toBeLessThan(100);
  });
});
