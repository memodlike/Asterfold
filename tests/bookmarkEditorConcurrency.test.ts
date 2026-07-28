import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Board, Page } from "../src/domain/models";

const mocks = vi.hoisted(() => ({
  createBookmark: vi.fn(),
  findDuplicate: vi.fn().mockResolvedValue(null),
  updateBookmark: vi.fn(),
}));

vi.mock("../src/db/repository", () => mocks);
vi.mock("../src/browser/api", () => ({ faviconUrl: vi.fn(() => "") }));

import { BookmarkEditor } from "../src/features/bookmarks/BookmarkEditor";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const page: Page = { id: "page", userId: null, title: "Workspace", icon: null, accent: null, position: "000000000001", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const board: Board = { id: "board", userId: null, pageId: page.id, title: "Inbox", icon: null, accent: null, position: "000000000001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };

describe("BookmarkEditor concurrency", () => {
  it("coalesces rapid form submissions into one database write", () => {
    mocks.createBookmark.mockImplementation(() => new Promise<never>(() => undefined));
    render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(BookmarkEditor, {
        open: true,
        bookmark: null,
        initialBoardId: board.id,
        initialUrl: "https://example.com/",
        initialTitle: "Example",
        pages: [page],
        boards: [board],
        onClose: vi.fn(),
        onSaved: vi.fn(),
        onError: vi.fn(),
      }),
    }));
    const form = screen.getByRole("textbox", { name: "Title" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);
    expect(mocks.createBookmark).toHaveBeenCalledTimes(1);
  });
});
