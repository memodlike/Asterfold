import { createElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Bookmark } from "../src/domain/models";

type CardProps = Parameters<typeof import("../src/features/bookmarks/BookmarkCard").BookmarkCard>[0];

const mocks = vi.hoisted(() => ({
  sortable: {
    attributes: {}, listeners: {}, transform: null, transition: undefined, isDragging: false,
    setNodeRef: vi.fn(),
  },
  drop: { isOver: false, setNodeRef: vi.fn() },
  cards: [] as CardProps[],
}));

vi.mock("@dnd-kit/core", () => ({ useDroppable: () => mocks.drop }));
vi.mock("@dnd-kit/sortable", async () => {
  const { createElement: h, Fragment } = await import("react");
  return {
    useSortable: () => mocks.sortable,
    SortableContext: ({ children }: { children: ReactNode }) => h(Fragment, null, children),
    rectSortingStrategy: vi.fn(),
  };
});
vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: vi.fn().mockReturnValue("translate3d(1px, 2px, 0)") } } }));
vi.mock("../src/features/bookmarks/BookmarkCard", () => ({ BookmarkCard: (props: CardProps) => { mocks.cards.push(props); return createElement("div", { "data-testid": `bookmark-${props.bookmark.id}` }, props.bookmark.title); } }));

import { BoardColumn } from "../src/features/boards/BoardColumn";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const board: Board = { id: "board", userId: null, pageId: "page", title: "Inbox", icon: null, accent: null, position: "0001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const bookmark: Bookmark = { id: "bookmark", userId: null, boardId: board.id, title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: "0001", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };

function handlers() {
  return {
    onAddBookmark: vi.fn(), onEditBoard: vi.fn(), onPatchBoard: vi.fn(), onMoveBoard: vi.fn(), onDuplicateBoard: vi.fn(), onDeleteBoard: vi.fn(), onKeyboardMoveBoard: vi.fn(),
    onOpenBookmark: vi.fn(), onEditBookmark: vi.fn(), onMoveBookmark: vi.fn(), onDuplicateBookmark: vi.fn(), onDeleteBookmark: vi.fn(), onCopyUrl: vi.fn(), onCopyMarkdown: vi.fn(), onSelectBookmark: vi.fn(),
  };
}

function renderColumn(overrides: Partial<Parameters<typeof BoardColumn>[0]> = {}) {
  const callbacks = handlers();
  const props: Parameters<typeof BoardColumn>[0] = {
    board, placement: { column: 1, row: 0, span: 3 }, bookmarks: [], privacy: false, selectedIds: new Set(),
    ...callbacks,
    ...overrides,
  };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(BoardColumn, props) }));
  return { ...view, props, callbacks };
}

beforeEach(() => {
  mocks.cards = [];
  mocks.sortable.isDragging = false;
  mocks.drop.isOver = false;
  vi.clearAllMocks();
});
afterEach(() => cleanup());

function openMenu(container: HTMLElement): void {
  const section = container.querySelector<HTMLElement>("section.board");
  expect(section).not.toBeNull();
  fireEvent.contextMenu(section!, { clientX: 20, clientY: 30 });
}

describe("BoardColumn behavior", () => {
  it("adds bookmarks from the header and empty state", () => {
    const { callbacks } = renderColumn();
    fireEvent.click(screen.getByRole("button", { name: "Add a bookmark to Inbox" }));
    fireEvent.click(screen.getByRole("button", { name: "Drop a link here or press +" }));
    expect(callbacks.onAddBookmark).toHaveBeenCalledTimes(2);
    expect(callbacks.onAddBookmark).toHaveBeenCalledWith(board);
  });

  it("routes keyboard board movement in both directions", () => {
    const { callbacks } = renderColumn();
    const title = screen.getByRole("button", { name: "Actions for Inbox" });
    fireEvent.keyDown(title, { key: "ArrowRight", altKey: true });
    fireEvent.keyDown(title, { key: "ArrowUp", altKey: true });
    expect(callbacks.onKeyboardMoveBoard).toHaveBeenNthCalledWith(1, board, 1);
    expect(callbacks.onKeyboardMoveBoard).toHaveBeenNthCalledWith(2, board, -1);
  });

  it("routes board context menu actions and closes after each action", () => {
    const { container, callbacks } = renderColumn();

    openMenu(container);
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(callbacks.onEditBoard).toHaveBeenCalledWith(board);

    openMenu(container);
    fireEvent.click(screen.getByRole("menuitem", { name: "Two columns" }));
    expect(callbacks.onPatchBoard).toHaveBeenCalledWith(board, { bookmarkColumns: 2 });

    openMenu(container);
    fireEvent.click(screen.getByRole("menuitem", { name: "Medium" }));
    expect(callbacks.onPatchBoard).toHaveBeenCalledWith(board, { gridSpan: 4 });

    openMenu(container);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to page" }));
    expect(callbacks.onMoveBoard).toHaveBeenCalledWith(board);

    openMenu(container);
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(callbacks.onDuplicateBoard).toHaveBeenCalledWith(board);

    openMenu(container);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to trash" }));
    expect(callbacks.onDeleteBoard).toHaveBeenCalledWith(board);
  });

  it("opens the context menu through Shift+F10", () => {
    const { container } = renderColumn();
    const section = container.querySelector<HTMLElement>("section.board")!;
    Object.defineProperty(section, "getBoundingClientRect", { value: () => ({ right: 80, bottom: 90 }) });
    fireEvent.keyDown(section, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu", { name: "Actions for Inbox" })).toBeVisible();
  });

  it("passes bookmark state and callbacks to cards and leaves automatic columns to container queries", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ ...bookmark, id: `bookmark-${index}`, title: `Bookmark ${index}`, position: String(index) }));
    const { container, callbacks } = renderColumn({ bookmarks: many, selectedIds: new Set([many[0]!.id]), placement: { column: 2, row: 1, span: 4 } });
    expect(mocks.cards).toHaveLength(12);
    expect(mocks.cards[0]?.selected).toBe(true);
    expect(mocks.cards[0]?.onOpen).toBe(callbacks.onOpenBookmark);
    expect(container.querySelector(".board__items--columns-auto")).not.toBeNull();
    expect(container.querySelector<HTMLElement>("section.board")?.style.gridColumn).toContain("span 4");
  });

  it("reflects drag and drop states", () => {
    mocks.sortable.isDragging = true;
    mocks.drop.isOver = true;
    const { container } = renderColumn({ board: { ...board, bookmarkColumns: 1 } });
    const section = container.querySelector("section.board");
    expect(section).toHaveClass("is-over", "is-dragging");
    expect(container.querySelector(".board__items--columns-1")).not.toBeNull();
  });
});
