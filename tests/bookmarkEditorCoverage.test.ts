import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Bookmark, Page } from "../src/domain/models";
import { DuplicateError } from "../src/domain/errors";

const mocks = vi.hoisted(() => ({
  createBookmark: vi.fn(),
  findDuplicate: vi.fn(),
  updateBookmark: vi.fn(),
  faviconUrl: vi.fn(),
}));

vi.mock("../src/db/repository", () => ({
  createBookmark: mocks.createBookmark,
  findDuplicate: mocks.findDuplicate,
  updateBookmark: mocks.updateBookmark,
}));
vi.mock("../src/browser/api", () => ({ faviconUrl: mocks.faviconUrl }));

import { BookmarkEditor } from "../src/features/bookmarks/BookmarkEditor";
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
const existing: Bookmark = {
  id: "bookmark-one",
  userId: null,
  boardId: "board-one",
  title: "Existing",
  url: "https://example.com/old",
  normalizedUrl: "https://example.com/old",
  hostname: "example.com",
  description: "Existing note",
  faviconUrl: null,
  customIcon: null,
  position: "a",
  openMode: "new-tab",
  pinned: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
  deletedBatchId: null,
  version: 1,
};
const duplicate = { ...existing, id: "duplicate", title: "Already saved" };

function callbacks() {
  return { onClose: vi.fn(), onSaved: vi.fn(), onError: vi.fn() };
}

function renderEditor(overrides: Partial<Parameters<typeof BookmarkEditor>[0]> = {}) {
  const handlers = callbacks();
  const props: Parameters<typeof BookmarkEditor>[0] = {
    open: true,
    bookmark: null,
    initialBoardId: "board-one",
    initialUrl: "https://example.com/new",
    initialTitle: "Initial",
    initialDescription: "Initial note",
    pages,
    boards,
    ...handlers,
    ...overrides,
  };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkEditor, props) }));
  return { ...view, handlers, props };
}

function form(): HTMLFormElement {
  return screen.getByRole("textbox", { name: "Title" }).closest("form")!;
}

const performanceMarkMock = vi.fn();
const performanceMeasureMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findDuplicate.mockResolvedValue(null);
  mocks.faviconUrl.mockReturnValue("chrome-extension://test/favicon");
  mocks.createBookmark.mockResolvedValue({ ...existing, id: "created", title: "Created", url: "https://created.example/" });
  mocks.updateBookmark.mockResolvedValue({ ...existing, title: "Updated" });
  performanceMarkMock.mockClear();
  Object.defineProperty(performance, "mark", { configurable: true, value: performanceMarkMock });
  performanceMeasureMock.mockClear();
  Object.defineProperty(performance, "measure", { configurable: true, value: performanceMeasureMock });
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BookmarkEditor complete behavior", () => {
  it("initializes a new bookmark, groups destinations and renders a live preview", () => {
    const { container } = renderEditor();
    expect(screen.getByRole("heading", { name: "Add bookmark" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Initial");
    expect(screen.getByRole("textbox", { name: "URL" })).toHaveValue("https://example.com/new");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Initial note");
    expect(screen.getByLabelText("Destination")).toHaveValue("board-one");
    expect(screen.getByLabelText("Open in")).toHaveValue("current");
    expect(container.querySelectorAll("optgroup")).toHaveLength(2);
    expect(container.querySelector("img")).toHaveAttribute("src", "chrome-extension://test/favicon");
  });

  it("resets all fields when editing an existing bookmark or reopening", () => {
    const view = renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Changed" } });
    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkEditor, { ...view.props, bookmark: existing }) }));
    expect(screen.getByRole("heading", { name: "Edit bookmark" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Existing");
    expect(screen.getByRole("textbox", { name: "URL" })).toHaveValue(existing.url);
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Existing note");
    expect(screen.getByLabelText("Destination")).toHaveValue("board-one");
    expect(screen.getByLabelText("Open in")).toHaveValue("new-tab");

    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkEditor, { ...view.props, open: false }) }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears duplicate lookup for closed, destination-less and non-http values", () => {
    vi.useFakeTimers();
    const view = renderEditor({ initialBoardId: "", initialUrl: "mailto:test@example.com" });
    act(() => { vi.advanceTimersByTime(300); });
    expect(mocks.findDuplicate).not.toHaveBeenCalled();
    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(BookmarkEditor, { ...view.props, open: false, initialBoardId: "board-one", initialUrl: "https://example.com" }) }));
    act(() => { vi.advanceTimersByTime(300); });
    expect(mocks.findDuplicate).not.toHaveBeenCalled();
  });

  it("finds duplicates after the debounce and clears stale lookup work", async () => {
    vi.useFakeTimers();
    mocks.findDuplicate.mockResolvedValueOnce(duplicate);
    const view = renderEditor();
    act(() => { vi.advanceTimersByTime(251); });
    await act(async () => { await Promise.resolve(); });
    expect(mocks.findDuplicate).toHaveBeenCalledWith("board-one", "https://example.com/new", undefined, undefined);
    expect(screen.getByText("Already saved")).toBeVisible();

    mocks.findDuplicate.mockRejectedValueOnce(new Error("lookup"));
    fireEvent.change(screen.getByRole("textbox", { name: "URL" }), { target: { value: "https://changed.example/" } });
    act(() => { vi.advanceTimersByTime(251); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Already saved")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "URL" }), { target: { value: "https://stale.example/" } });
    view.unmount();
    act(() => { vi.advanceTimersByTime(251); });
  });

  it("creates a bookmark with edited values and records performance markers", async () => {
    const { handlers } = renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Created" } });
    fireEvent.change(screen.getByRole("textbox", { name: "URL" }), { target: { value: "https://created.example/" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Created note" } });
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "board-two" } });
    fireEvent.change(screen.getByLabelText("Open in"), { target: { value: "incognito" } });
    fireEvent.submit(form());
    await waitFor(() => expect(mocks.createBookmark).toHaveBeenCalledWith({
      boardId: "board-two",
      title: "Created",
      url: "https://created.example/",
      description: "Created note",
      openMode: "incognito",
    }, { allowDuplicate: false }));
    expect(performanceMarkMock).toHaveBeenCalledWith("asterfold-save-start");
    expect(performanceMarkMock).toHaveBeenCalledWith("asterfold-save-committed");
    expect(performanceMeasureMock).toHaveBeenCalledWith("asterfold-local-save", "asterfold-save-start", "asterfold-save-committed");
    expect(handlers.onSaved).toHaveBeenCalled();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("updates an existing bookmark without the create duplicate option", async () => {
    const { handlers } = renderEditor({ bookmark: existing });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Updated" } });
    fireEvent.change(screen.getByLabelText("Open in"), { target: { value: "new-window" } });
    fireEvent.submit(form());
    await waitFor(() => expect(mocks.updateBookmark).toHaveBeenCalledWith(existing.id, expect.objectContaining({ title: "Updated", openMode: "new-window" })));
    expect(mocks.createBookmark).not.toHaveBeenCalled();
    expect(handlers.onSaved).toHaveBeenCalled();
  });

  it("handles DuplicateError, lets a new bookmark opt into a copy and resubmits", async () => {
    mocks.createBookmark.mockRejectedValueOnce(new DuplicateError("duplicate", duplicate.id));
    mocks.findDuplicate.mockResolvedValue(duplicate);
    renderEditor();
    fireEvent.submit(form());
    await waitFor(() => expect(screen.getByText("Already saved")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Save another copy" }));
    expect(screen.getByRole("button", { name: "A copy will be saved" })).toBeVisible();
    mocks.createBookmark.mockResolvedValueOnce({ ...existing, id: "copy" });
    fireEvent.submit(form());
    await waitFor(() => expect(mocks.createBookmark).toHaveBeenLastCalledWith(expect.any(Object), { allowDuplicate: true }));
  });

  it("shows duplicate information for edits without offering Save another copy", async () => {
    vi.useFakeTimers();
    mocks.findDuplicate.mockResolvedValue(duplicate);
    renderEditor({ bookmark: existing });
    act(() => { vi.advanceTimersByTime(251); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Already saved")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save another copy" })).toBeNull();
  });

  it("reports generic persistence failures and re-enables Save", async () => {
    mocks.createBookmark.mockRejectedValueOnce(new Error("save"));
    const { handlers } = renderEditor();
    fireEvent.submit(form());
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to save bookmark"));
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("coalesces pending submissions and exposes the saving state", async () => {
    let finish: ((value: Bookmark) => void) | undefined;
    mocks.createBookmark.mockImplementationOnce(() => new Promise<Bookmark>((resolve) => { finish = resolve; }));
    renderEditor();
    fireEvent.submit(form());
    fireEvent.submit(form());
    expect(mocks.createBookmark).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    act(() => { finish?.({ ...existing, id: "finished" }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled());
  });

  it("disables Save without a destination and supports Cancel", () => {
    const { handlers } = renderEditor({ initialBoardId: "", boards: [] });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("protects content and only renders a Close action in privacy mode", () => {
    const { handlers } = renderEditor({ privacy: true });
    expect(screen.getByText("Search content is protected")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("uses the generic bookmark icon when privacy is active or the URL is not HTTP", () => {
    const privacy = renderEditor({ privacy: true });
    expect(privacy.container.querySelector("img")).toBeNull();
    privacy.unmount();
    mocks.faviconUrl.mockReturnValue("");
    const mail = renderEditor({ initialUrl: "mailto:test@example.com" });
    expect(mail.container.querySelector("img")).toBeNull();
  });
});
