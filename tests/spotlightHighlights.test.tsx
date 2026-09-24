import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Bookmark, Page } from "../src/domain/models";
import { highlightMatch } from "../src/features/search/highlightMatch";
import { SearchPalette } from "../src/features/search/SearchPalette";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const pages: Page[] = [
  { id: "p1", userId: null, title: "Work", icon: null, accent: null, position: "a", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "p2", userId: null, title: "Home", icon: null, accent: null, position: "b", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];
const board = (id: string, pageId: string, title: string): Board => ({ id, userId: null, pageId, title, icon: null, accent: null, position: id, collapsed: false, layout: "list", bookmarkColumns: 1, gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
const boards = [board("b1", "p1", "Docs"), board("b2", "p2", "Later")];
const bookmark = (id: string, boardId: string, title: string, url: string): Bookmark => ({ id, userId: null, boardId, title, url, normalizedUrl: url, hostname: new URL(url).hostname, description: null, faviconUrl: null, customIcon: null, position: id, openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 });
const bookmarks = [
  bookmark("k1", "b1", "Google Docs", "https://docs.google.com/"),
  bookmark("k2", "b1", "GitHub", "https://github.com/"),
  bookmark("k3", "b2", "Google Maps", "https://maps.google.com/"),
];

function boardDom(): void {
  for (const item of bookmarks.filter((entry) => entry.boardId === "b1")) {
    const node = document.createElement("article");
    node.className = "bookmark-card";
    node.dataset.bookmarkId = item.id;
    document.body.append(node);
  }
}

function renderPalette(privacy = false) {
  const handlers = { onClose: vi.fn(), onOpen: vi.fn(), onReveal: vi.fn(), onEdit: vi.fn(), onMove: vi.fn(), onCopy: vi.fn(), onDelete: vi.fn() };
  const view = render(<I18nProvider preference="en"><SearchPalette open privacy={privacy} pages={pages} boards={boards} bookmarks={bookmarks} activePageId="p1" {...handlers} /></I18nProvider>);
  return { ...view, handlers };
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  boardDom();
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-bookmark-id]").forEach((node) => node.remove());
  vi.unstubAllGlobals();
});

describe("spotlight search", () => {
  it("marks the first match without injecting markup", () => {
    const { container } = render(<p>{highlightMatch("Google <Docs>", "<docs>")}</p>);
    expect(container.querySelector("mark")?.textContent).toBe("<Docs>");
    expect(container.innerHTML).toContain("&lt;");
    const word = render(<p>{highlightMatch("Release notes", "draft notes")}</p>);
    expect(word.container.querySelector("mark")?.textContent).toBe("notes");
    expect(highlightMatch("Plain", "zzz")).toBe("Plain");
    expect(highlightMatch("Plain", "  ")).toBe("Plain");
    expect(highlightMatch("İstanbul notes", "notes")).toBe("İstanbul notes");
  });

  it("lights matching bookmarks on the active page and clears them on close", () => {
    const { unmount } = renderPalette();
    const input = screen.getByRole("textbox", { name: "Search and commands" });
    fireEvent.change(input, { target: { value: "google" } });
    const docs = document.querySelector<HTMLElement>('[data-bookmark-id="k1"]')!;
    const github = document.querySelector<HTMLElement>('[data-bookmark-id="k2"]')!;
    expect(document.documentElement.dataset.spotlight).toBe("active");
    expect(docs).toHaveAttribute("data-search-hit");
    expect(github).not.toHaveAttribute("data-search-hit");
    expect(screen.getByText("Found: 2")).toBeVisible();
    expect(screen.getByText("Matches are lit on your boards")).toBeVisible();
    // Results from another page show their page in the path instead of lighting anything here.
    expect(screen.getByText("Home › Later")).toBeVisible();

    // The keyboard-active result gets the stronger ring on its board; off-page results light nothing.
    fireEvent.mouseEnter(document.getElementById("spotlight-result-k3")!);
    expect(document.querySelector("[data-search-current]")).toBeNull();
    fireEvent.mouseEnter(document.getElementById("spotlight-result-k1")!);
    expect(docs).toHaveAttribute("data-search-current");
    expect(input).toHaveAttribute("aria-activedescendant", "spotlight-result-k1");

    fireEvent.change(input, { target: { value: "" } });
    expect(docs).not.toHaveAttribute("data-search-hit");
    expect(document.documentElement.dataset.spotlight).toBeUndefined();

    fireEvent.change(input, { target: { value: "github" } });
    expect(github).toHaveAttribute("data-search-hit");
    act(() => unmount());
    expect(github).not.toHaveAttribute("data-search-hit");
    expect(document.documentElement.dataset.spotlight).toBeUndefined();
  });

  it("never highlights boards while privacy mode hides content", () => {
    renderPalette(true);
    expect(screen.getByRole("textbox", { name: "Search and commands" })).toBeDisabled();
    expect(document.documentElement.dataset.spotlight).toBeUndefined();
    expect(document.querySelector("[data-search-hit]")).toBeNull();
  });
});
