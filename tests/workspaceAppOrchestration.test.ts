import { createElement, type MouseEvent as ReactMouseEvent } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { AppSettings, Board, Bookmark, Page, WorkspaceData } from "../src/domain/models";

type BoardCanvasProps = Parameters<typeof import("../src/features/boards/BoardCanvas").BoardCanvas>[0];
type LauncherProps = Parameters<typeof import("../src/app/AppLauncher").AppLauncher>[0];
type NameDialogProps = Parameters<typeof import("../src/components/NameDialog").NameDialog>[0];
type MoveDialogProps = Parameters<typeof import("../src/components/MoveDialog").MoveDialog>[0];
type SearchProps = Parameters<typeof import("../src/features/search/SearchPalette").SearchPalette>[0];
type SettingsProps = Parameters<typeof import("../src/features/settings/SettingsDialog").SettingsDialog>[0];
type TrashProps = Parameters<typeof import("../src/features/trash/TrashDialog").TrashDialog>[0];
type EditorProps = Parameters<typeof import("../src/features/bookmarks/BookmarkEditor").BookmarkEditor>[0];

const mocks = vi.hoisted(() => ({
  workspaceState: { workspace: null, failed: false, retry: vi.fn() } as {
    workspace: WorkspaceData | null;
    failed: boolean;
    retry: () => void;
  },
  canvas: null as BoardCanvasProps | null,
  launcher: null as LauncherProps | null,
  nameDialog: null as NameDialogProps | null,
  moveDialog: null as MoveDialogProps | null,
  search: null as SearchProps | null,
  settings: null as SettingsProps | null,
  trash: null as TrashProps | null,
  editor: null as EditorProps | null,
  privacy: false,
  setPrivacy: vi.fn().mockResolvedValue(undefined),
  toastPush: vi.fn(),
  createBoard: vi.fn().mockResolvedValue(undefined),
  createPage: vi.fn().mockResolvedValue(undefined),
  duplicateBoard: vi.fn().mockResolvedValue(undefined),
  duplicateBookmark: vi.fn().mockResolvedValue(undefined),
  duplicatePage: vi.fn().mockResolvedValue(undefined),
  moveBoardToIndex: vi.fn().mockResolvedValue(undefined),
  moveBoardWithGridSwap: vi.fn().mockResolvedValue(undefined),
  moveBookmarkToIndex: vi.fn().mockResolvedValue(undefined),
  movePageToIndex: vi.fn().mockResolvedValue(undefined),
  renamePage: vi.fn().mockResolvedValue(undefined),
  restoreBoard: vi.fn().mockResolvedValue(undefined),
  restoreBookmark: vi.fn().mockResolvedValue(undefined),
  restorePage: vi.fn().mockResolvedValue(undefined),
  setDefaultPage: vi.fn().mockResolvedValue(undefined),
  softDeleteBoard: vi.fn().mockResolvedValue(undefined),
  softDeleteBookmark: vi.fn().mockResolvedValue(undefined),
  softDeletePage: vi.fn().mockResolvedValue(undefined),
  updateBoard: vi.fn().mockResolvedValue(undefined),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  bulkDeleteBookmarks: vi.fn().mockResolvedValue(undefined),
  bulkMoveBookmarks: vi.fn().mockResolvedValue(undefined),
  bulkRestoreBookmarks: vi.fn().mockResolvedValue(undefined),
  openUrl: vi.fn().mockResolvedValue(undefined),
  copyText: vi.fn().mockResolvedValue(undefined),
  requestErrorClass: null as (new (code: string) => Error & { code: string }) | null,
}));

vi.mock("../src/app/useWorkspace", () => ({ useWorkspace: () => mocks.workspaceState }));
vi.mock("../src/app/usePrivacyMode", () => ({ usePrivacyMode: () => ({ privacy: mocks.privacy, setPrivacy: mocks.setPrivacy }) }));
vi.mock("../src/features/appearance/useThemeRuntime", () => ({ useThemeRuntime: () => ({}) }));
vi.mock("../src/components/ToastRegion", async () => {
  const { createElement: h } = await import("react");
  return { useToasts: () => ({ push: mocks.toastPush, region: h("div", { "data-testid": "toast-region" }) }) };
});
vi.mock("../src/db/repository", () => ({
  bulkDeleteBookmarks: mocks.bulkDeleteBookmarks,
  bulkMoveBookmarks: mocks.bulkMoveBookmarks,
  bulkRestoreBookmarks: mocks.bulkRestoreBookmarks,
  createBoard: mocks.createBoard,
  createPage: mocks.createPage,
  duplicateBoard: mocks.duplicateBoard,
  duplicateBookmark: mocks.duplicateBookmark,
  duplicatePage: mocks.duplicatePage,
  moveBoardToIndex: mocks.moveBoardToIndex,
  moveBoardWithGridSwap: mocks.moveBoardWithGridSwap,
  moveBookmarkToIndex: mocks.moveBookmarkToIndex,
  movePageToIndex: mocks.movePageToIndex,
  renamePage: mocks.renamePage,
  restoreBoard: mocks.restoreBoard,
  restoreBookmark: mocks.restoreBookmark,
  restorePage: mocks.restorePage,
  setDefaultPage: mocks.setDefaultPage,
  softDeleteBoard: mocks.softDeleteBoard,
  softDeleteBookmark: mocks.softDeleteBookmark,
  softDeletePage: mocks.softDeletePage,
  updateBoard: mocks.updateBoard,
  updateSettings: mocks.updateSettings,
}));
vi.mock("../src/browser/api", () => {
  class RequestError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  mocks.requestErrorClass = RequestError;
  return { copyText: mocks.copyText, openUrl: mocks.openUrl, ExtensionRequestError: RequestError };
});
vi.mock("../src/features/boards/BoardCanvas", () => ({ BoardCanvas: (props: BoardCanvasProps) => { mocks.canvas = props; return null; } }));
vi.mock("../src/app/AppLauncher", () => ({ AppLauncher: (props: LauncherProps) => { mocks.launcher = props; return null; } }));
vi.mock("../src/components/NameDialog", () => ({ NameDialog: (props: NameDialogProps) => { mocks.nameDialog = props; return null; } }));
vi.mock("../src/components/MoveDialog", () => ({ MoveDialog: (props: MoveDialogProps) => { mocks.moveDialog = props; return null; } }));
vi.mock("../src/features/search/SearchPalette", () => ({ SearchPalette: (props: SearchProps) => { mocks.search = props; return null; } }));
vi.mock("../src/features/settings/SettingsDialog", () => ({ SettingsDialog: (props: SettingsProps) => { mocks.settings = props; return null; } }));
vi.mock("../src/features/trash/TrashDialog", () => ({ TrashDialog: (props: TrashProps) => { mocks.trash = props; return null; } }));
vi.mock("../src/features/bookmarks/BookmarkEditor", () => ({ BookmarkEditor: (props: EditorProps) => { mocks.editor = props; return null; } }));

import { WorkspaceApp } from "../src/app/WorkspaceApp";

const timestamp = "2026-01-01T00:00:00.000Z";
const page: Page = { id: "page", userId: null, title: "Work", icon: null, accent: null, position: "0001", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const pageTwo: Page = { ...page, id: "page-two", title: "Personal", position: "0002", isDefault: false };
const board: Board = { id: "board", userId: null, pageId: page.id, title: "Inbox", icon: null, accent: null, position: "0001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const boardTwo: Board = { ...board, id: "board-two", title: "Later", position: "0002" };
const bookmark: Bookmark = { id: "bookmark", userId: null, boardId: board.id, title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: "0001", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const bookmarkTwo: Bookmark = { ...bookmark, id: "bookmark-two", title: "Second", position: "0002" };

function workspace(overrides: Partial<AppSettings> = {}): WorkspaceData {
  const settings = { ...createDefaultSettings(), activePageId: page.id, onboardingComplete: false, ...overrides };
  return { pages: [page, pageTwo], boards: [board, boardTwo], bookmarks: [bookmark, bookmarkTwo], settings };
}

async function settle(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canvas = null;
  mocks.launcher = null;
  mocks.nameDialog = null;
  mocks.moveDialog = null;
  mocks.search = null;
  mocks.settings = null;
  mocks.trash = null;
  mocks.editor = null;
  mocks.privacy = false;
  mocks.workspaceState.workspace = workspace();
  mocks.workspaceState.failed = false;
  Object.defineProperty(performance, "mark", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  Object.defineProperty(globalThis, "CSS", { configurable: true, value: { escape: (value: string) => value } });
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
});

describe("WorkspaceApp orchestration", () => {
  it("renders failure, loading, and repair states", () => {
    mocks.workspaceState.workspace = null;
    mocks.workspaceState.failed = true;
    const failed = render(createElement(WorkspaceApp));
    fireEvent.click(screen.getByRole("button"));
    expect(mocks.workspaceState.retry).toHaveBeenCalledOnce();
    failed.unmount();

    mocks.workspaceState.failed = false;
    const loading = render(createElement(WorkspaceApp));
    expect(loading.container.querySelector(".app-loading")).not.toBeNull();
    loading.unmount();

    mocks.workspaceState.workspace = { ...workspace(), pages: [] };
    const repairing = render(createElement(WorkspaceApp));
    expect(repairing.container.querySelector(".app-loading")).not.toBeNull();
  });

  it("routes page, board, bookmark, search, settings, and trash actions", async () => {
    window.history.replaceState({}, "", "/?page=page-two");
    render(createElement(WorkspaceApp));
    await waitFor(() => expect(mocks.canvas).not.toBeNull());
    expect(mocks.updateSettings).toHaveBeenCalledWith({ activePageId: pageTwo.id });

    await act(async () => { mocks.launcher?.onCreatePage(); });
    expect(mocks.nameDialog?.open).toBe(true);
    await act(async () => { await mocks.nameDialog?.onSubmit("New page"); });
    expect(mocks.createPage).toHaveBeenCalledWith("New page");

    await act(async () => { mocks.launcher?.onRenamePage(page); });
    await act(async () => { await mocks.nameDialog?.onSubmit("Renamed page"); });
    expect(mocks.renamePage).toHaveBeenCalledWith(page.id, "Renamed page");

    mocks.launcher?.onSelectPage(pageTwo.id);
    mocks.launcher?.onDuplicatePage(page);
    mocks.launcher?.onDefaultPage(pageTwo);
    mocks.launcher?.onMovePage(pageTwo, 0);
    mocks.launcher?.onDeletePage(pageTwo);
    await settle();
    expect(mocks.updateSettings).toHaveBeenCalledWith({ activePageId: pageTwo.id });
    expect(mocks.duplicatePage).toHaveBeenCalledWith(page.id);
    expect(mocks.setDefaultPage).toHaveBeenCalledWith(pageTwo.id);
    expect(mocks.movePageToIndex).toHaveBeenCalledWith(pageTwo.id, 0);
    expect(mocks.softDeletePage).toHaveBeenCalledWith(pageTwo.id);

    await act(async () => { mocks.canvas?.onCreateBoard(); });
    await act(async () => { await mocks.nameDialog?.onSubmit("New board"); });
    expect(mocks.createBoard).toHaveBeenCalledWith(page.id, "New board");
    await act(async () => { mocks.canvas?.onEditBoard(board); });
    await act(async () => { await mocks.nameDialog?.onSubmit("Renamed board"); });
    expect(mocks.updateBoard).toHaveBeenCalledWith(board.id, { title: "Renamed board" });

    mocks.canvas?.onPatchBoard(board, { gridSpan: 4 });
    mocks.canvas?.onDuplicateBoard(board);
    mocks.canvas?.onDeleteBoard(board);
    mocks.canvas?.onMoveBoardIndex(board.id, 1, boardTwo.id);
    await settle();
    expect(mocks.updateBoard).toHaveBeenCalledWith(board.id, { gridSpan: 4 });
    expect(mocks.duplicateBoard).toHaveBeenCalledWith(board.id);
    expect(mocks.softDeleteBoard).toHaveBeenCalledWith(board.id);
    expect(mocks.moveBoardToIndex).toHaveBeenCalledWith(board.id, page.id, 1);

    await act(async () => { mocks.canvas?.onAddBookmark(board); });
    expect(mocks.editor?.initialBoardId).toBe(board.id);
    mocks.canvas?.onEditBookmark(bookmark);
    expect(mocks.editor?.bookmark).toEqual(bookmark);
    mocks.canvas?.onDuplicateBookmark(bookmark);
    mocks.canvas?.onDeleteBookmark(bookmark);
    mocks.canvas?.onMoveBookmarkIndex(bookmark.id, boardTwo.id, 0);
    mocks.canvas?.onOpenBookmark(bookmark);
    mocks.canvas?.onCopyUrl(bookmark);
    mocks.canvas?.onCopyMarkdown(bookmark);
    await settle();
    expect(mocks.duplicateBookmark).toHaveBeenCalledWith(bookmark.id);
    expect(mocks.softDeleteBookmark).toHaveBeenCalledWith(bookmark.id);
    expect(mocks.moveBookmarkToIndex).toHaveBeenCalledWith(bookmark.id, boardTwo.id, 0);
    expect(mocks.openUrl).toHaveBeenCalledWith(bookmark.url, bookmark.openMode);
    expect(mocks.copyText).toHaveBeenCalledWith(bookmark.url);
    expect(mocks.copyText).toHaveBeenCalledWith(`[${bookmark.title}](${bookmark.url})`);

    await act(async () => { mocks.launcher?.onSearch(); });
    expect(mocks.search?.open).toBe(true);
    mocks.search?.onReveal(bookmark, pageTwo.id);
    mocks.search?.onEdit(bookmark);
    mocks.search?.onMove(bookmark);
    mocks.search?.onCopy(bookmark);
    mocks.search?.onDelete(bookmark);
    await settle();
    expect(mocks.editor?.bookmark).toEqual(bookmark);
    expect(mocks.moveDialog?.type).toBe("bookmark");

    await act(async () => { mocks.canvas?.onImport(); });
    expect(mocks.settings?.initialSection).toBe("data-privacy");
    await act(async () => { mocks.launcher?.onSettings(); });
    expect(mocks.settings?.initialSection).toBe("appearance");
    await act(async () => { mocks.launcher?.onTrash(); });
    expect(mocks.trash?.open).toBe(true);
  });

  it("handles privacy, selection, bulk actions, keyboard search, and request errors", async () => {
    render(createElement(WorkspaceApp));
    await waitFor(() => expect(mocks.canvas).not.toBeNull());

    await act(async () => {
      mocks.canvas?.onSelectBookmark(bookmark, { ctrlKey: false, metaKey: false, shiftKey: false } as ReactMouseEvent);
    });
    expect(screen.getByText("1")).toBeVisible();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons.find((item) => item.textContent?.includes("Move"))!);
    expect(mocks.moveDialog?.type).toBe("bulk-bookmarks");
    await act(async () => { await mocks.moveDialog?.onMove(boardTwo.id); });
    expect(mocks.bulkMoveBookmarks).toHaveBeenCalledWith([bookmark.id], boardTwo.id);

    await act(async () => {
      mocks.canvas?.onSelectBookmark(bookmark, { ctrlKey: false, metaKey: false, shiftKey: false } as ReactMouseEvent);
    });
    fireEvent.click(screen.getAllByRole("button").find((item) => item.textContent?.includes("Delete"))!);
    await settle();
    expect(mocks.bulkDeleteBookmarks).toHaveBeenCalled();

    await act(async () => { mocks.launcher?.onPrivacy(); });
    expect(mocks.setPrivacy).toHaveBeenCalledWith(true);
    await act(async () => { mocks.launcher?.onDismissFirstRunHint?.(); });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ onboardingComplete: true });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(mocks.search?.open).toBe(true);

    const RequestError = mocks.requestErrorClass!;
    mocks.openUrl.mockRejectedValueOnce(new RequestError("UNSAFE_URL"));
    mocks.canvas?.onOpenBookmark(bookmark);
    await waitFor(() => expect(mocks.toastPush).toHaveBeenCalled());

    mocks.copyText.mockRejectedValueOnce(new Error("clipboard"));
    mocks.canvas?.onCopyUrl(bookmarkTwo);
    await waitFor(() => expect(mocks.toastPush).toHaveBeenCalled());
  });

  it("uses free-layout board swaps and blocks clipboard copy in privacy mode", async () => {
    mocks.privacy = true;
    mocks.workspaceState.workspace = workspace({ workspaceLayoutMode: "free" });
    render(createElement(WorkspaceApp));
    await waitFor(() => expect(mocks.canvas).not.toBeNull());

    mocks.canvas?.onMoveBoardIndex(board.id, 1, boardTwo.id);
    mocks.canvas?.onCopyUrl(bookmark);
    mocks.canvas?.onCopyMarkdown(bookmark);
    await settle();
    expect(mocks.moveBoardWithGridSwap).toHaveBeenCalledWith(board.id, boardTwo.id, page.id, 1);
    expect(mocks.copyText).not.toHaveBeenCalled();
    expect(mocks.toastPush).toHaveBeenCalled();
  });
});