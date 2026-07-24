import { createElement } from "react";
import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkCard } from "../src/features/bookmarks/BookmarkCard";
import { I18nProvider } from "../src/i18n";
import { safeCustomIconUrl } from "../src/domain/icons";
import type { Bookmark } from "../src/domain/models";

const bookmark: Bookmark = {
  id: "bookmark-private",
  userId: null,
  boardId: "board-private",
  title: "Secret payroll portal",
  url: "https://payroll.example/private",
  normalizedUrl: "https://payroll.example/private",
  hostname: "payroll.example",
  description: "Confidential",
  faviconUrl: "https://tracker.invalid/favicon.ico",
  customIcon: "https://tracker.invalid/custom.svg",
  position: "a",
  openMode: "current",
  pinned: false,
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
  deletedAt: null,
  deletedBatchId: null,
  version: 1,
};

afterEach(cleanup);

function renderCard(privacy: boolean): ReturnType<typeof render> {
  const callback = vi.fn();
  return render(createElement(
    I18nProvider,
    {
      preference: "en",
      children: createElement(
      DndContext,
      null,
      createElement(BookmarkCard, {
        bookmark,
        privacy,
        selected: false,
        onOpen: callback,
        onEdit: callback,
        onMove: callback,
        onDuplicate: callback,
        onDelete: callback,
        onCopyUrl: callback,
        onCopyMarkdown: callback,
        onSelect: callback,
      }),
    ),
    },
  ));
}

describe("favicon and privacy contract", () => {
  it("accepts only bounded raster data URLs as custom icons", () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7S8AAAAASUVORK5CYII=";
    expect(safeCustomIconUrl(png)).toBe(png);
    expect(safeCustomIconUrl("https://tracker.invalid/icon.png")).toBe("");
    expect(safeCustomIconUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe("");
    expect(safeCustomIconUrl(`data:image/png;base64,${"A".repeat(200_000)}`)).toBe("");
  });

  it("does not render remote favicon fields and resets to Chrome favicon", () => {
    const view = renderCard(false);
    expect(view.container.querySelector('img[src*="tracker.invalid"]')).toBeNull();
  });

  it("removes the real bookmark title from privacy DOM and context menu", () => {
    const view = renderCard(true);
    expect(view.baseElement.textContent).not.toContain(bookmark.title);
    expect(view.container.querySelector(`[title*="${bookmark.title}"]`)).toBeNull();
    expect(screen.getByRole("button", { name: "Open hidden bookmark" })).toBeVisible();

    fireEvent.contextMenu(view.container.querySelector("article")!);
    expect(screen.getByRole("menu", { name: "Hidden bookmark actions" })).toBeVisible();
    expect(view.baseElement.textContent).not.toContain(bookmark.title);
    expect(screen.getByRole("menuitem", { name: "Copy URL" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Copy Markdown" })).toBeDisabled();
  });
});
