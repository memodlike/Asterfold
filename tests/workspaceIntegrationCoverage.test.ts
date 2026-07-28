import { createElement, type MouseEvent as ReactMouseEvent } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, Board, Bookmark, Page, WorkspaceData } from "../src/domain/models";

const mocks = vi.hoisted(() => ({
  workspaceState: { workspace: undefined as WorkspaceData | undefined, failed: false, retry: vi.fn() },
  privacyState: { privacy: false, setPrivacy: vi.fn().mockResolvedValue(undefined) },
  repository: {
    bulkDeleteBookmarks: vi.fn().mockResolvedValue(undefined),
    bulkMoveBookmarks: vi.fn().mockResolvedValue(undefined),
    bulkRestoreBookmarks: vi.fn().mockResolvedValue(undefined),
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
  },
  browser: {
    copyText: vi.fn().mockResolvedValue(undefined),
    openUrl: vi.fn().mockResolvedValue(undefined),
  },
  exportSelection: {
    createSelectionBackup: vi.fn().mockResolvedValue({ format: "asterfold-backup", formatVersion: 3 }),
    serializeBackup: vi.fn(() => "{}"),
    downloadText: vi.fn(),
  },
}));

vi.mock("../src/app/useWorkspace", () => ({ useWorkspace: () => mocks.workspaceState }));
vi.mock("../src/app/usePrivacyMode", () => ({ usePrivacyMode: () => mocks.privacyState }));
vi.mock("../src/features/appearance/useThemeRuntime", () => ({ useThemeRuntime: () => ({}) }));
vi.mock("../src/db/repository", () => mocks.repository);
vi.mock("../src/browser/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/browser/api")>();
  return { ...actual, copyText: mocks.browser.copyText, openUrl: mocks.browser.openUrl, faviconUrl: vi.fn(() => null) };
});
vi.mock("../src/services/exportImport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/exportImport")>();
  return { ...actual, ...mocks.exportSelection };
});

vi.mock("../src/features/search/SearchPalette", async () => {
  const { createElement } = await import("react");
  interface Props {
    bookmarks: Bookmark[];
    pages: Page[];
    onClose: () => void;
    onOpen: (bookmark: Bookmark) => void;
    onReveal: (bookmark: Bookmark, pageId: string) => void;
    onEdit: (bookmark: Bookmark) => void;
    onMove: (bookmark: Bookmark) => void;
    onCopy: (bookmark: Bookmark) => void;
    onDelete: (bookmark: Bookmark) => void;
  }
  return {
    SearchPalette: (props: Props) => createElement("div", { role: "dialog", "aria-label": "Search double" },
      createElement("button", { onClick: props.onClose }, "Close search"),
      createElement("button", { onClick: () => props.onOpen(props.bookmarks[0]!) }, "Search open"),
      createElement("button", { onClick: () => props.onReveal(props.bookmarks[0]!, props.pages[0]!.id) }, "Search reveal"),
      createElement("button", { onClick: () => props.onEdit(props.bookmarks[0]!) }, "Search edit"),
      createElement("button", { onClick: () => props.onMove(props.bookmarks[0]!) }, "Search move"),
      createElement("button", { onClick: () => props.onCopy(props.bookmarks[0]!) }, "Search copy"),
      createElement("button", { onClick: () => props.onDelete(props.bookmarks[0]!) }, "Search delete"),
    ),
  };
});

vi.mock("../src/features/bookmarks/BookmarkEditor", async () => {
  const { createElement } = await import("react");
  interface Props { onClose: () => void; onSaved: () => void; onError: (message: string) => void }
  return {
    BookmarkEditor: (props: Props) => createElement("div", { role: "dialog", "aria-label": "Editor double" },
      createElement("button", { onClick: props.onSaved }, "Editor saved"),
      createElement("button", { onClick: () => props.onError("editor error") }, "Editor error"),
      createElement("button", { onClick: props.onClose }, "Close editor"),
    ),
  };
});

vi.mock("../src/features/settings/SettingsDialog", async () => {
  const { createElement } = await import("react");
  interface Props { onClose: () => void; onUpdated: (message: string) => void; onError: (message: string) => void; onOpenTrash: () => void }
  return {
    SettingsDialog: (props: Props) => createElement("div", { role: "dialog", "aria-label": "Settings double" },
      createElement("button", { onClick: () => props.onUpdated("settings updated") }, "Settings updated"),
      createElement("button", { onClick: () => props.onError("settings error") }, "Settings error"),
      createElement("button", { onClick: props.onOpenTrash }, "Settings trash"),
      createElement("button", { onClick: props.onClose }, "Close settings"),
    ),
  };
});

vi.mock("../src/features/trash/TrashDialog", async () => {
  const { createElement } = await import("react");
  interface Props { onClose: () => void; onChanged: (message: string) => void; onError: (message: string) => void }
  return {
    TrashDialog: (props: Props) => createElement("div", { role: "dialog", "aria-label": "Trash double" },
      createElement("button", { onClick: () => props.onChanged("trash changed") }, "Trash changed"),
      createElement("button", { onClick: () => props.onError("trash error") }, "Trash error"),
      createElement("button", { onClick: props.onClose }, "Close trash"),
    ),
  };
});

import { createDefaultSettings } from "../src/db/defaults";
import { WorkspaceApp } from "../src/app/WorkspaceApp";

const timestamp = "2026-01-01T00:00:00.000Z";
const pages: Page[] = [
  { id: "p1", userId: null, title: "Workspace", icon: null, accent: null, position: "a", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "p2", userId: null, title: "Reference", icon: null, accent: null, position: "b", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];
const boards: Board[] = [
  { id: "b1", userId: null, pageId: "p1", title: "Inbox", icon: null, accent: null, position: "a", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "b2", userId: null, pageId: "p2", title: "Archive", icon: null, accent: null, position: "b", collapsed: false, layout: "list", bookmarkColumns: 1, gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];
const bookmarks: Bookmark[] = [
  { id: "m1", userId: null, boardId: "b1", title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: "Example description", faviconUrl: null, customIcon: null, position: "a", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "m2", userId: null, boardId: "b1", title: "Second", url: "https://second.example/", normalizedUrl: "https://second.example/", hostname: "second.example", description: null, faviconUrl: null, customIcon: null, position: "b", openMode: "new-tab", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];

function workspace(overrides: Partial<AppSettings> = {}): WorkspaceData {
  const settings = { ...createDefaultSettings(), locale: "en" as const, activePageId: "p1", onboardingComplete: true, ...overrides };
  return { pages, boards, bookmarks, settings };
}

function openLauncher(): void {
  fireEvent.click(screen.getByRole("button", { name: "Open Asterfold menu" }));
}

function openBookmarkContext(): void {
  fireEvent.contextMenu(document.querySelector<HTMLElement>('[data-bookmark-id="m1"]')!, { clientX: 20, clientY: 30 });
}

function openBoardContext(): void {
  fireEvent.contextMenu(document.querySelector<HTMLElement>('[data-board-id="b1"]')!, { clientX: 20, clientY: 30 });
}

describe("workspace integration coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceState.workspace = workspace();
    mocks.workspaceState.failed = false;
    mocks.privacyState.privacy = false;
    Object.defineProperty(performance, "mark", { configurable: true, value: vi.fn() });
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    Object.defineProperty(globalThis.CSS, "escape", { configurable: true, value: (value: string) => value });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  it("renders loading and recoverable failure states", () => {
    mocks.workspaceState.workspace = undefined;
    const view = render(createElement(WorkspaceApp));
    expect(screen.getByText("Opening your workspace…")).toBeVisible();

    mocks.workspaceState.failed = true;
    view.rerender(createElement(WorkspaceApp));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.workspaceState.retry).toHaveBeenCalledOnce();
  });

  it("opens bookmarks, selects ranges and executes bulk actions", async () => {
    render(createElement(WorkspaceApp));
    fireEvent.click(screen.getByRole("button", { name: "Open Example" }));
    expect(mocks.browser.openUrl).toHaveBeenCalledWith("https://example.com/", "current");

    fireEvent.click(screen.getByRole("button", { name: "Open Example" }), { ctrlKey: true });
    expect(screen.getByText("1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocks.exportSelection.createSelectionBackup).toHaveBeenCalledWith(["m1"]));
    expect(mocks.exportSelection.downloadText).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocks.repository.bulkDeleteBookmarks).toHaveBeenCalledWith(["m1"]));
    expect(mocks.repository.bulkRestoreBookmarks).not.toHaveBeenCalled();
  });

  it("creates and renames pages and boards from launcher and context menus", async () => {
    render(createElement(WorkspaceApp));
    openLauncher();
    fireEvent.click(screen.getByRole("menuitem", { name: "New board" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Project" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocks.repository.createBoard).toHaveBeenCalledWith("p1", "Project"));

    openLauncher();
    fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New page" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Research" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocks.repository.createPage).toHaveBeenCalledWith("Research"));

    openBoardContext();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Renamed inbox" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.repository.updateBoard).toHaveBeenCalledWith("b1", { title: "Renamed inbox" }));
  });

  it("executes board and bookmark context actions", async () => {
    render(createElement(WorkspaceApp));
    openBoardContext();
    fireEvent.click(screen.getByRole("button", { name: "Two columns" }));
    expect(mocks.repository.updateBoard).toHaveBeenCalledWith("b1", { bookmarkColumns: 2 });

    openBoardContext();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(mocks.repository.duplicateBoard).toHaveBeenCalledWith("b1");

    openBookmarkContext();
    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));
    await waitFor(() => expect(mocks.browser.copyText).toHaveBeenCalledWith("https://example.com/"));

    openBookmarkContext();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(mocks.repository.duplicateBookmark).toHaveBeenCalledWith("m1");

    openBookmarkContext();
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    await waitFor(() => expect(mocks.repository.softDeleteBookmark).toHaveBeenCalledWith("m1"));
  });

  it("moves bookmarks and boards through destination dialogs", async () => {
    render(createElement(WorkspaceApp));
    openBookmarkContext();
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(screen.getByRole("combobox")).toHaveValue("b2");
    fireEvent.click(screen.getAllByRole("button", { name: "Move" }).at(-1)!);
    await waitFor(() => expect(mocks.repository.moveBookmarkToIndex).toHaveBeenCalledWith("m1", "b2", Number.MAX_SAFE_INTEGER));

    openBoardContext();
    fireEvent.click(screen.getByRole("button", { name: "Move to page" }));
    expect(screen.getByRole("combobox")).toHaveValue("p2");
    fireEvent.click(screen.getAllByRole("button", { name: "Move" }).at(-1)!);
    await waitFor(() => expect(mocks.repository.moveBoardToIndex).toHaveBeenCalledWith("b1", "p2", Number.MAX_SAFE_INTEGER));
  });

  it("routes search, editor, settings, privacy and trash callbacks", async () => {
    render(createElement(WorkspaceApp));
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Search double" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Search copy" }));
    await waitFor(() => expect(mocks.browser.copyText).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Search reveal" }));
    expect(mocks.repository.updateSettings).toHaveBeenCalledWith({ activePageId: "p1" });
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));

    fireEvent.click(screen.getByRole("button", { name: "Add bookmark to Inbox" }));
    expect(await screen.findByRole("dialog", { name: "Editor double" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Editor saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Editor error" }));
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));

    openLauncher();
    fireEvent.click(screen.getByRole("menuitem", { name: "Turn privacy on" }));
    await waitFor(() => expect(mocks.privacyState.setPrivacy).toHaveBeenCalledWith(true));

    openLauncher();
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(await screen.findByRole("dialog", { name: "Settings double" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Settings updated" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings error" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings trash" }));
    expect(await screen.findByRole("dialog", { name: "Trash double" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Trash changed" }));
    fireEvent.click(screen.getByRole("button", { name: "Trash error" }));
    fireEvent.click(screen.getByRole("button", { name: "Close trash" }));
  });

  it("masks clipboard actions in privacy mode and maps navigation errors", async () => {
    mocks.workspaceState.workspace = workspace({ onboardingComplete: false });
    mocks.privacyState.privacy = true;
    render(createElement(WorkspaceApp));
    openBookmarkContext();
    expect(screen.getByRole("button", { name: "Copy URL" })).toBeDisabled();

    mocks.browser.openUrl.mockRejectedValueOnce(new Error("navigation"));
    fireEvent.click(screen.getByRole("button", { name: "Open hidden bookmark" }));
    expect(await screen.findByText("The action could not be completed.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    await waitFor(() => expect(mocks.repository.updateSettings).toHaveBeenCalledWith({ onboardingComplete: true }));
  });

  it("supports board keyboard movement and bookmark selection callbacks", () => {
    const onSelect = vi.fn((_bookmark: Bookmark, _event: ReactMouseEvent) => undefined);
    expect(onSelect).not.toHaveBeenCalled();
    render(createElement(WorkspaceApp));
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Inbox" }), { altKey: true, key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Open Second" }), { shiftKey: true });
    expect(screen.getByText("1")).toBeVisible();
  });
});
