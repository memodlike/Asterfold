import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDocuments: vi.fn(() => []),
  engineConstructor: vi.fn(),
}));

vi.mock("../src/search/searchEngine", () => ({
  createSearchDocuments: mocks.createDocuments,
  BookmarkSearchEngine: class {
    public constructor() { mocks.engineConstructor(); }
    public search(): never[] { return []; }
  },
}));

import { SearchPalette } from "../src/features/search/SearchPalette";
import { I18nProvider } from "../src/i18n";

afterEach(() => {
  cleanup();
  mocks.createDocuments.mockClear();
  mocks.engineConstructor.mockClear();
});

describe("private search", () => {
  it("does not create documents or an index while privacy mode is active", () => {
    const palette = createElement(SearchPalette, {
      open: true,
      privacy: true,
      pages: [],
      boards: [],
      bookmarks: [],
      activePageId: "page",
      onClose: vi.fn(),
      onOpen: vi.fn(),
      onReveal: vi.fn(),
      onEdit: vi.fn(),
      onMove: vi.fn(),
      onCopy: vi.fn(),
      onDelete: vi.fn(),
    });
    render(createElement(I18nProvider, { preference: "en", children: palette }));
    expect(mocks.createDocuments).not.toHaveBeenCalled();
    expect(mocks.engineConstructor).not.toHaveBeenCalled();
  });
});
