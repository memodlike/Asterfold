import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emptyTrash: vi.fn(),
  permanentlyDelete: vi.fn(),
  restoreBoard: vi.fn(),
  restoreBookmark: vi.fn(),
  restorePage: vi.fn(),
  useLiveQuery: vi.fn(),
}));

const confirmMock = vi.fn();

vi.mock("dexie-react-hooks", () => ({ useLiveQuery: mocks.useLiveQuery }));
vi.mock("../src/db/database", () => ({ db: {} }));
vi.mock("../src/db/repository", () => ({
  emptyTrash: mocks.emptyTrash,
  listTrash: vi.fn(),
  permanentlyDelete: mocks.permanentlyDelete,
  restoreBoard: mocks.restoreBoard,
  restoreBookmark: mocks.restoreBookmark,
  restorePage: mocks.restorePage,
}));

import { TrashDialog } from "../src/features/trash/TrashDialog";
import { I18nProvider } from "../src/i18n";

const trash = {
  pages: [{ id: "page-1", title: "Deleted Page", deletedAt: "2026-07-25T12:00:00.000Z" }],
  boards: [{ id: "board-1", title: "Deleted Board", deletedAt: null }],
  bookmarks: [
    { id: "bookmark-1", title: "Older Bookmark", deletedAt: "2026-07-24T12:00:00.000Z" },
    { id: "bookmark-2", title: "Newest Bookmark", deletedAt: "2026-07-27T12:00:00.000Z" },
  ],
};

function callbacks() {
  return { onClose: vi.fn(), onChanged: vi.fn(), onError: vi.fn() };
}

function renderTrash(overrides: Partial<Parameters<typeof TrashDialog>[0]> = {}) {
  const handlers = callbacks();
  const props: Parameters<typeof TrashDialog>[0] = { open: true, ...handlers, ...overrides };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(TrashDialog, props) }));
  return { ...view, handlers, props };
}

function row(title: string): HTMLElement {
  return screen.getByText(title).closest("article")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useLiveQuery.mockReturnValue(trash);
  mocks.restorePage.mockResolvedValue(undefined);
  mocks.restoreBoard.mockResolvedValue(undefined);
  mocks.restoreBookmark.mockResolvedValue(undefined);
  mocks.permanentlyDelete.mockResolvedValue(undefined);
  mocks.emptyTrash.mockResolvedValue(4);
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
  vi.spyOn(window, "confirm").mockImplementation(confirmMock);
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TrashDialog complete behavior", () => {
  it("sorts deleted records, formats metadata and filters every item type", () => {
    renderTrash();
    const articles = screen.getAllByRole("article");
    expect(within(articles[0]!).getByText("Newest Bookmark")).toBeVisible();
    expect(screen.getByText("Items: 4")).toBeVisible();
    expect(within(row("Deleted Board")).getByText("Boards")).toBeVisible();
    expect(within(row("Deleted Page")).getByText(/Pages ·/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Pages" }));
    expect(screen.getByText("Deleted Page")).toBeVisible();
    expect(screen.queryByText("Deleted Board")).toBeNull();
    expect(screen.getByText("Items: 1")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Boards" }));
    expect(screen.getByText("Deleted Board")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Bookmarks" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("masks all titles in privacy mode and renders the empty state without a footer action", () => {
    const view = renderTrash({ privacy: true });
    expect(screen.getAllByText("Hidden bookmark")).toHaveLength(4);
    expect(screen.queryByText("Deleted Page")).toBeNull();

    mocks.useLiveQuery.mockReturnValue({ pages: [], boards: [], bookmarks: [] });
    view.rerender(createElement(I18nProvider, { preference: "en", children: createElement(TrashDialog, view.props) }));
    expect(screen.getByText("Trash is empty")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Empty trash" })).toBeNull();
  });

  it("restores pages, boards and bookmarks and reports each success", async () => {
    const { handlers } = renderTrash();
    for (const [title, restore] of [
      ["Deleted Page", mocks.restorePage],
      ["Deleted Board", mocks.restoreBoard],
      ["Older Bookmark", mocks.restoreBookmark],
    ] as const) {
      fireEvent.click(within(row(title)).getByRole("button", { name: "Restore" }));
      await waitFor(() => expect(restore).toHaveBeenCalled());
    }
    expect(mocks.restorePage).toHaveBeenCalledWith("page-1");
    expect(mocks.restoreBoard).toHaveBeenCalledWith("board-1");
    expect(mocks.restoreBookmark).toHaveBeenCalledWith("bookmark-1");
    expect(handlers.onChanged).toHaveBeenCalledTimes(3);
    expect(handlers.onChanged).toHaveBeenCalledWith("Restored from trash");
  });

  it("maps restore failures and releases the pending key", async () => {
    mocks.restoreBoard.mockRejectedValueOnce(new Error("restore"));
    const { handlers } = renderTrash();
    const button = within(row("Deleted Board")).getByRole("button", { name: "Restore" });
    fireEvent.click(button);
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Restore failed"));
    expect(button).not.toBeDisabled();
  });

  it("cancels permanent deletion before mutation", () => {
    confirmMock.mockReturnValue(false);
    renderTrash();
    fireEvent.click(within(row("Deleted Page")).getByRole("button", { name: "Delete" }));
    expect(mocks.permanentlyDelete).not.toHaveBeenCalled();
  });

  it("permanently deletes every supported type and reports failures", async () => {
    const { handlers } = renderTrash();
    fireEvent.click(within(row("Deleted Page")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocks.permanentlyDelete).toHaveBeenCalledWith("page", "page-1"));
    fireEvent.click(within(row("Deleted Board")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocks.permanentlyDelete).toHaveBeenCalledWith("board", "board-1"));
    fireEvent.click(within(row("Older Bookmark")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocks.permanentlyDelete).toHaveBeenCalledWith("bookmark", "bookmark-1"));
    expect(handlers.onChanged).toHaveBeenCalledWith("Permanently deleted");

    mocks.permanentlyDelete.mockRejectedValueOnce(new Error("delete"));
    fireEvent.click(within(row("Newest Bookmark")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to permanently delete the item"));
  });

  it("prevents duplicate destructive work while an item action is pending", async () => {
    let finish: (() => void) | undefined;
    mocks.permanentlyDelete.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderTrash();
    const itemRow = row("Deleted Page");
    const deleteButton = within(itemRow).getByRole("button", { name: "Delete" });
    const restoreButton = within(itemRow).getByRole("button", { name: "Restore" });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);
    fireEvent.click(restoreButton);
    expect(mocks.permanentlyDelete).toHaveBeenCalledOnce();
    expect(mocks.restorePage).not.toHaveBeenCalled();
    expect(deleteButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Empty trash" })).toBeDisabled();
    act(() => { finish?.(); });
    await waitFor(() => expect(deleteButton).not.toBeDisabled());
  });

  it("empties Trash after confirmation and reports the deleted count", async () => {
    const { handlers } = renderTrash();
    fireEvent.click(screen.getByRole("button", { name: "Empty trash" }));
    await waitFor(() => expect(mocks.emptyTrash).toHaveBeenCalledOnce());
    expect(handlers.onChanged).toHaveBeenCalledWith("Items: 4");
  });

  it("cancels and fails empty-trash operations safely", async () => {
    const { handlers } = renderTrash();
    confirmMock.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Empty trash" }));
    expect(mocks.emptyTrash).not.toHaveBeenCalled();

    mocks.emptyTrash.mockRejectedValueOnce(new Error("empty"));
    fireEvent.click(screen.getByRole("button", { name: "Empty trash" }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to empty Trash"));
  });
});
