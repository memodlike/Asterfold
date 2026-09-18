import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bookmark } from "../src/domain/models";
import { BookmarkCard } from "../src/features/bookmarks/BookmarkCard";
import { I18nProvider } from "../src/i18n";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
    attributes: { "aria-roledescription": "sortable" },
    listeners: {},
  })),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: vi.fn(() => "") } },
}));

const timestamp = "2026-01-01T00:00:00.000Z";
const bookmark: Bookmark = {
  id: "bm-integration",
  userId: null,
  boardId: "board-integration",
  title: "Production Bookmark",
  url: "https://github.com/memodlike/Asterfold",
  normalizedUrl: "https://github.com/memodlike/Asterfold",
  hostname: "github.com",
  description: "Real production path test",
  faviconUrl: "https://malicious.tracker/poison.ico", // Poisoned legacy field
  customIcon: "https://malicious.tracker/custom.svg", // Poisoned legacy field
  position: "a0",
  openMode: "current",
  pinned: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
  deletedBatchId: null,
  version: 1,
};

describe("BookmarkCard real production favicon integration", () => {
  let getURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getURL = vi.fn((path: string) => `chrome-extension://asterfold-live${path}`);
    vi.stubGlobal("chrome", { runtime: { getURL } });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reaches real production faviconUrl and renders Chrome _favicon without trusting poisoned fields", () => {
    const { container } = render(
      createElement(I18nProvider, {
        preference: "en",
        children: createElement(BookmarkCard, {
          bookmark,
          faviconSize: 32,
          privacy: false,
          selected: false,
          onOpen: vi.fn(),
          onEdit: vi.fn(),
          onMove: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onCopyUrl: vi.fn(),
          onCopyMarkdown: vi.fn(),
          onSelect: vi.fn(),
        }),
      }),
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    const src = img?.getAttribute("src") ?? "";
    expect(src).toContain("chrome-extension://asterfold-live/_favicon/");
    expect(src).toContain("pageUrl=https%3A%2F%2Fgithub.com%2Fmemodlike%2FAsterfold");
    expect(src).toContain("size=");
    // Proves legacy poisoned URLs are never rendered
    expect(src).not.toContain("malicious.tracker");
    expect(getURL).toHaveBeenCalledWith("/_favicon/");
  });

  it("handles image load failure gracefully by falling back to neutral Globe SVG", () => {
    const { container } = render(
      createElement(I18nProvider, {
        preference: "en",
        children: createElement(BookmarkCard, {
          bookmark,
          faviconSize: 32,
          privacy: false,
          selected: false,
          onOpen: vi.fn(),
          onEdit: vi.fn(),
          onMove: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onCopyUrl: vi.fn(),
          onCopyMarkdown: vi.fn(),
          onSelect: vi.fn(),
        }),
      }),
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("never invokes faviconUrl or renders img in privacy mode", () => {
    const { container } = render(
      createElement(I18nProvider, {
        preference: "en",
        children: createElement(BookmarkCard, {
          bookmark,
          faviconSize: 32,
          privacy: true,
          selected: false,
          onOpen: vi.fn(),
          onEdit: vi.fn(),
          onMove: vi.fn(),
          onDuplicate: vi.fn(),
          onDelete: vi.fn(),
          onCopyUrl: vi.fn(),
          onCopyMarkdown: vi.fn(),
          onSelect: vi.fn(),
        }),
      }),
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(getURL).not.toHaveBeenCalled();
  });
});
