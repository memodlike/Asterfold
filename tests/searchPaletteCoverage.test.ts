import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Bookmark, Page } from "../src/domain/models";
import { SearchPalette } from "../src/features/search/SearchPalette";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const pages: Page[] = [
  { id: "page-one", userId: null, title: "Work", icon: null, accent: null, position: "a", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "page-two", userId: null, title: "Personal", icon: null, accent: null, position: "b", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];
const boards: Board[] = [
  { id: "board-one", userId: null, pageId: "page-one", title: "Inbox", icon: null, accent: null, position: "a", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "board-two", userId: null, pageId: "page-two", title: "Reading", icon: null, accent: null, position: "b", collapsed: false, layout: "list", bookmarkColumns: 1, gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];
const bookmarks: Bookmark[] = [
  { id: "bookmark-one", userId: null, boardId: "board-one", title: "Example Architecture", url: "https://example.com/architecture", normalizedUrl: "https://example.com/architecture", hostname: "example.com", description: "Design reference", faviconUrl: null, customIcon: null, position: "a", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "bookmark-two", userId: null, boardId: "board-two", title: "Example Personal", url: "https://personal.example.org/notes", normalizedUrl: "https://personal.example.org/notes", hostname: "personal.example.org", description: "Private reading", faviconUrl: null, customIcon: null, position: "b", openMode: "new-tab", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "bookmark-three", userId: null, boardId: "board-one", title: "Unrelated", url: "https://other.test/", normalizedUrl: "https://other.test/", hostname: "other.test", description: null, faviconUrl: null, customIcon: null, position: "c", openMode: "new-window", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];

function callbacks() {
  return {
    onClose: vi.fn(),
    onOpen: vi.fn(),
    onReveal: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
  };
}

function renderPalette(overrides: Partial<Parameters<typeof SearchPalette>[0]> = {}) {
  const handlers = callbacks();
  const props: Parameters<typeof SearchPalette>[0] = {
    open: true,
    privacy: false,
    pages,
    boards,
    bookmarks,
    activePageId: "page-one",
    ...handlers,
    ...overrides,
  };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(SearchPalette, props) }));
  return { ...view, handlers, props };
}

function query(value: string): HTMLInputElement {
  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SearchPalette interaction coverage", () => {
  it("focuses the search input and shows start, empty and privacy states", () => {
    const view = renderPalette();
    act(() => { vi.runOnlyPendingTimers(); });
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByText("Start typing to search.")).toBeVisible();

    query("no-result-token");
    expect(screen.getByText("No matches. Try a shorter query.")).toBeVisible();

    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(SearchPalette, { ...view.props, privacy: true }) }));
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("textbox")).toHaveValue("Search is hidden while privacy mode is on");
    expect(screen.getByText("Search content is protected")).toBeVisible();
  });

  it("opens the active result with pointer and keyboard navigation", () => {
    const { handlers } = renderPalette();
    const input = query("Example");
    const main = screen.getByRole("button", { name: /Example Architecture/ });
    expect(main).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: /Example Personal/ })).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(main).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(handlers.onOpen).toHaveBeenCalledWith(bookmarks[0]);
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("does not activate a result during IME composition and clamps navigation", () => {
    const { handlers } = renderPalette();
    const input = query("Example");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: /Example Architecture/ })).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: /Example Personal/ })).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it("routes every result action with the expected close behavior", () => {
    for (const action of ["Reveal", "Edit", "Move", "Copy URL", "Delete"] as const) {
      cleanup();
      const { handlers } = renderPalette();
      query("Architecture");
      fireEvent.click(screen.getByRole("button", { name: action }));
      if (action === "Reveal") {
        expect(handlers.onReveal).toHaveBeenCalledWith(bookmarks[0], "page-one");
        expect(handlers.onClose).toHaveBeenCalledOnce();
      } else if (action === "Edit") {
        expect(handlers.onEdit).toHaveBeenCalledWith(bookmarks[0]);
        expect(handlers.onClose).toHaveBeenCalledOnce();
      } else if (action === "Move") {
        expect(handlers.onMove).toHaveBeenCalledWith(bookmarks[0]);
        expect(handlers.onClose).toHaveBeenCalledOnce();
      } else if (action === "Copy URL") {
        expect(handlers.onCopy).toHaveBeenCalledWith(bookmarks[0]);
        expect(handlers.onClose).not.toHaveBeenCalled();
      } else {
        expect(handlers.onDelete).toHaveBeenCalledWith(bookmarks[0]);
        expect(handlers.onClose).toHaveBeenCalledOnce();
      }
    }
  });

  it("changes search modes, fields and page scope while resetting the active result", () => {
    renderPalette();
    query("Example");
    fireEvent.mouseEnter(screen.getAllByRole("listitem")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Exact" }));
    expect(screen.getByRole("button", { name: "Exact" })).toHaveClass("is-active");
    query("Example Architecture");
    expect(screen.getByText("Example Architecture")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Prefix" }));
    query("Example");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    fireEvent.change(screen.getByRole("combobox", { name: "Search and commands" }), { target: { value: "url" } });
    query("personal.example");
    expect(screen.getByText("Example Personal")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "This page" }));
    expect(screen.getByText("No matches. Try a shorter query.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Everywhere" }));
    expect(screen.getByText("Example Personal")).toBeVisible();
  });

  it("updates the active result on pointer hover and ignores missing bookmarks", () => {
    const view = renderPalette();
    query("Example");
    const results = screen.getAllByRole("listitem");
    fireEvent.mouseEnter(results[1]!);
    expect(screen.getByRole("button", { name: /Example Personal/ })).toHaveAttribute("aria-current", "true");

    view.rerender(createElement(I18nProvider, {
      preference: "en",
      children: createElement(SearchPalette, { ...view.props, bookmarks: [bookmarks[0]!] }),
    }));
    expect(screen.queryByText("Example Personal")).toBeNull();
  });
});
