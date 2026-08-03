import { createElement, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bookmark } from "../src/domain/models";

const mocks = vi.hoisted(() => ({
  sortable: {
    setNodeRef: vi.fn(),
    transform: { x: 2, y: 3, scaleX: 1, scaleY: 1 },
    transition: "transform 100ms",
    isDragging: false,
    attributes: { "aria-roledescription": "sortable" },
    listeners: { onPointerDown: vi.fn() },
  },
  faviconUrl: vi.fn(() => "chrome-extension://test/_favicon/example"),
}));

vi.mock("@dnd-kit/sortable", () => ({ useSortable: vi.fn(() => mocks.sortable) }));
vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: vi.fn(() => "translate3d(2px, 3px, 0)") } } }));
vi.mock("../src/browser/api", () => ({ faviconUrl: mocks.faviconUrl }));

import { BookmarkCard } from "../src/features/bookmarks/BookmarkCard";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const bookmark: Bookmark = {
  id: "bookmark",
  userId: null,
  boardId: "board",
  title: "Example",
  url: "https://example.com/",
  normalizedUrl: "https://example.com/",
  hostname: "example.com",
  description: null,
  faviconUrl: null,
  customIcon: null,
  position: "a",
  openMode: "current",
  pinned: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
  deletedBatchId: null,
  version: 1,
};

function callbacks() {
  return {
    onOpen: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onCopyUrl: vi.fn(),
    onCopyMarkdown: vi.fn(),
    onSelect: vi.fn(),
  };
}

function renderCard(overrides: Partial<ComponentProps<typeof BookmarkCard>> = {}) {
  const handlers = callbacks();
  const props: ComponentProps<typeof BookmarkCard> = { bookmark, privacy: false, selected: false, ...handlers, ...overrides };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkCard, props) }));
  return { ...view, handlers, props };
}

function openContext(): void {
  fireEvent.contextMenu(document.querySelector("article")!, { clientX: 250, clientY: 180 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sortable.isDragging = false;
  mocks.sortable.transform = { x: 2, y: 3, scaleX: 1, scaleY: 1 };
  mocks.faviconUrl.mockReturnValue("chrome-extension://test/_favicon/example");
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", { configurable: true, value: vi.fn(() => ({ x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40, toJSON: () => ({}) })) });
});

afterEach(() => cleanup());

describe("BookmarkCard complete behavior", () => {
  it("renders sortable state, favicon, title and drag styles", () => {
    mocks.sortable.isDragging = true;
    const { container } = renderCard({ selected: true });
    const card = container.querySelector("article")!;
    expect(card).toHaveClass("is-selected", "is-dragging");
    expect(card).toHaveAttribute("data-bookmark-id", bookmark.id);
    expect(card).toHaveStyle({ transform: "translate3d(2px, 3px, 0)", transition: "transform 100ms" });
    expect(mocks.sortable.setNodeRef).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open Example" })).toHaveAttribute("aria-roledescription", "sortable");
    expect(container.querySelector("img")).toHaveAttribute("src", "chrome-extension://test/_favicon/example");
  });

  it("opens normally and selects for every modified click", () => {
    const { handlers } = renderCard();
    const open = screen.getByRole("button", { name: "Open Example" });
    fireEvent.click(open);
    expect(handlers.onOpen).toHaveBeenCalledWith(bookmark);
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) fireEvent.click(open, modifiers);
    expect(handlers.onSelect).toHaveBeenCalledTimes(3);
    expect(handlers.onSelect).toHaveBeenCalledWith(bookmark, expect.any(Object));
  });

  it("falls back from a failed favicon and resets when the source changes", () => {
    const view = renderCard();
    fireEvent.error(view.container.querySelector("img")!);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByText("E")).toBeVisible();

    const changed = { ...bookmark, id: "changed", url: "https://changed.test/", normalizedUrl: "https://changed.test/", hostname: "changed.test" };
    mocks.faviconUrl.mockReturnValue("chrome-extension://test/_favicon/changed");
    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkCard, { ...view.props, bookmark: changed }) }));
    expect(view.container.querySelector("img")).toHaveAttribute("src", "chrome-extension://test/_favicon/changed");
  });

  it("uses hostname, title and question-mark monograms when no icon is available", () => {
    mocks.faviconUrl.mockReturnValue("");
    const view = renderCard();
    expect(screen.getByText("E")).toBeVisible();
    const titleFallback = { ...bookmark, hostname: "", title: "Title" };
    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkCard, { ...view.props, bookmark: titleFallback }) }));
    expect(screen.getByText("T")).toBeVisible();
    const unknown = { ...bookmark, hostname: "", title: "" };
    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkCard, { ...view.props, bookmark: unknown }) }));
    expect(screen.getByText("?")).toBeVisible();
  });

  it("routes every context action and closes the menu", () => {
    for (const actionName of ["Open", "Edit", "Move", "Copy URL", "Copy Markdown", "Duplicate", "Move to trash"] as const) {
      cleanup();
      const { handlers } = renderCard();
      openContext();
      fireEvent.click(screen.getByRole("menuitem", { name: actionName }));
      if (actionName === "Open") expect(handlers.onOpen).toHaveBeenCalledWith(bookmark);
      if (actionName === "Edit") expect(handlers.onEdit).toHaveBeenCalledWith(bookmark);
      if (actionName === "Move") expect(handlers.onMove).toHaveBeenCalledWith(bookmark);
      if (actionName === "Copy URL") expect(handlers.onCopyUrl).toHaveBeenCalledWith(bookmark);
      if (actionName === "Copy Markdown") expect(handlers.onCopyMarkdown).toHaveBeenCalledWith(bookmark);
      if (actionName === "Duplicate") expect(handlers.onDuplicate).toHaveBeenCalledWith(bookmark);
      if (actionName === "Move to trash") expect(handlers.onDelete).toHaveBeenCalledWith(bookmark);
      expect(screen.queryByRole("menu")).toBeNull();
    }
  });

  it("opens the context menu with Shift+F10 and closes it without an action", () => {
    renderCard();
    const open = screen.getByRole("button", { name: "Open Example" });
    fireEvent.keyDown(open, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu", { name: "Actions for Example" })).toHaveStyle({ left: "110px", top: "60px" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("protects the accessible tree and clipboard commands in privacy mode", () => {
    mocks.faviconUrl.mockReturnValue("");
    renderCard({ privacy: true });
    expect(screen.getByRole("button", { name: "Open hidden bookmark" })).toBeVisible();
    expect(screen.getByText("••••••••")).toHaveClass("private-content", "private-placeholder");
    expect(screen.getByText("•")).toBeVisible();
    fireEvent.contextMenu(document.querySelector("article")!);
    expect(screen.getByRole("menu", { name: "Hidden bookmark actions" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Copy URL" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Copy Markdown" })).toBeDisabled();
  });
});
