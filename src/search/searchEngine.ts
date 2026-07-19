import MiniSearch, { type SearchResult } from "minisearch";
import type { Board, Bookmark, Page } from "../domain/models";

export type SearchMode = "fuzzy" | "prefix" | "exact";
export type SearchField = "all" | "title" | "url";

export interface SearchDocument {
  id: string;
  title: string;
  url: string;
  hostname: string;
  description: string;
  pageTitle: string;
  boardTitle: string;
  pageId: string;
  boardId: string;
}

export interface SearchQueryOptions {
  mode: SearchMode;
  field: SearchField;
  pageId?: string;
  boardId?: string;
  limit?: number;
}

export interface BookmarkSearchResult extends SearchDocument {
  score: number;
  match: Record<string, string[]>;
}

export function createSearchDocuments(pages: Page[], boards: Board[], bookmarks: Bookmark[]): SearchDocument[] {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const documents: SearchDocument[] = [];
  for (const bookmark of bookmarks) {
    if (bookmark.deletedAt !== null) continue;
    const board = boardById.get(bookmark.boardId);
    const page = board ? pageById.get(board.pageId) : undefined;
    if (!board || !page || board.deletedAt !== null || page.deletedAt !== null) continue;
    documents.push({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      hostname: bookmark.hostname,
      description: bookmark.description ?? "",
      pageTitle: page.title,
      boardTitle: board.title,
      pageId: page.id,
      boardId: board.id,
    });
  }
  return documents;
}

export class BookmarkSearchEngine {
  private readonly documents = new Map<string, SearchDocument>();
  private readonly index = new MiniSearch<SearchDocument>({
    fields: ["title", "url", "hostname", "description", "pageTitle", "boardTitle"],
    storeFields: ["title", "url", "hostname", "description", "pageTitle", "boardTitle", "pageId", "boardId"],
    searchOptions: {
      boost: { title: 4, hostname: 2.5, boardTitle: 1.5, pageTitle: 1.25, description: 1 },
      prefix: true,
      fuzzy: 0.35,
      combineWith: "AND",
    },
    tokenize: (text) => text.toLocaleLowerCase().split(/[\s/._?&=#:-]+/u).filter(Boolean),
    processTerm: (term) => term.toLocaleLowerCase(),
  });

  public constructor(documents: SearchDocument[] = []) {
    this.replaceAll(documents);
  }

  public replaceAll(documents: SearchDocument[]): void {
    this.index.removeAll();
    this.documents.clear();
    for (const document of documents) this.documents.set(document.id, document);
    if (documents.length > 0) this.index.addAll(documents);
  }

  public upsert(document: SearchDocument): void {
    if (this.documents.has(document.id)) this.index.discard(document.id);
    this.documents.set(document.id, document);
    this.index.add(document);
  }

  public remove(id: string): void {
    this.documents.delete(id);
    this.index.discard(id);
  }

  public search(query: string, options: SearchQueryOptions): BookmarkSearchResult[] {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) return [];
    const fieldNames = options.field === "title" ? ["title"] : options.field === "url" ? ["url", "hostname"] : undefined;
    const filter = (result: SearchResult): boolean => {
      const pageId = String(result.pageId ?? "");
      const boardId = String(result.boardId ?? "");
      return (options.pageId === undefined || options.pageId === pageId)
        && (options.boardId === undefined || options.boardId === boardId);
    };

    let results: SearchResult[];
    if (options.mode === "exact") {
      const fields = options.field === "title"
        ? ["title"]
        : options.field === "url"
          ? ["url", "hostname"]
          : ["title", "url", "hostname", "description", "pageTitle", "boardTitle"];
      results = [...this.documents.values()]
        .filter((document) => fields.some((field) => String(document[field as keyof SearchDocument]).toLocaleLowerCase().includes(normalized)))
        .map((document) => ({ ...document, score: 1, match: {}, terms: [], queryTerms: [] } as unknown as SearchResult))
        .filter(filter);
    } else {
      results = this.index.search(normalized, {
        ...(fieldNames ? { fields: fieldNames } : {}),
        prefix: options.mode === "prefix" || options.mode === "fuzzy",
        fuzzy: options.mode === "fuzzy" ? 0.35 : false,
        combineWith: "AND",
        filter,
      });
    }

    return results.slice(0, options.limit ?? 60).map((result) => ({
      id: result.id as string,
      title: String(result.title),
      url: String(result.url),
      hostname: String(result.hostname),
      description: String(result.description),
      pageTitle: String(result.pageTitle),
      boardTitle: String(result.boardTitle),
      pageId: String(result.pageId),
      boardId: String(result.boardId),
      score: result.score,
      match: result.match,
    }));
  }
}
