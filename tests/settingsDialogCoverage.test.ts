import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { Board, Bookmark, Page, Wallpaper, WorkspaceData } from "../src/domain/models";
import type { AsterfoldBackup, ImportRecord } from "../src/services/exportImport";

const mocks = vi.hoisted(() => ({
  auditInvariants: vi.fn(),
  getWallpaper: vi.fn(),
  saveWallpaper: vi.fn(),
  updateSettings: vi.fn(),
  readSessionPrivacy: vi.fn(),
  writeSessionPrivacy: vi.fn(),
  createBackup: vi.fn(),
  downloadText: vi.fn(),
  importRecords: vi.fn(),
  restoreBackup: vi.fn(),
  serializeBackup: vi.fn(),
  toMarkdown: vi.fn(),
  toNetscapeHtml: vi.fn(),
  parseBackupOffThread: vi.fn(),
  parseHtmlOffThread: vi.fn(),
  commandsGetAll: vi.fn(),
  permissionRequest: vi.fn(),
  bookmarksGetTree: vi.fn(),
  tabsCreate: vi.fn(),
}));

const confirmMock = vi.fn();

vi.mock("wxt/browser", () => ({
  browser: {
    commands: { getAll: mocks.commandsGetAll },
    permissions: { request: mocks.permissionRequest },
    bookmarks: { getTree: mocks.bookmarksGetTree },
    tabs: { create: mocks.tabsCreate },
  },
}));
vi.mock("../src/browser/privacySession", () => ({
  readSessionPrivacy: mocks.readSessionPrivacy,
  writeSessionPrivacy: mocks.writeSessionPrivacy,
}));
vi.mock("../src/db/repository", () => ({
  auditInvariants: mocks.auditInvariants,
  getWallpaper: mocks.getWallpaper,
  saveWallpaper: mocks.saveWallpaper,
  updateSettings: mocks.updateSettings,
}));
vi.mock("../src/services/exportImport", () => ({
  CURRENT_BACKUP_FORMAT_VERSION: 3,
  createBackup: mocks.createBackup,
  downloadText: mocks.downloadText,
  importRecords: mocks.importRecords,
  restoreBackup: mocks.restoreBackup,
  serializeBackup: mocks.serializeBackup,
  toMarkdown: mocks.toMarkdown,
  toNetscapeHtml: mocks.toNetscapeHtml,
}));
vi.mock("../src/services/importWorker", () => ({
  parseBackupOffThread: mocks.parseBackupOffThread,
  parseHtmlOffThread: mocks.parseHtmlOffThread,
}));

import { SettingsDialog } from "../src/features/settings/SettingsDialog";
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
const bookmarks: Bookmark[] = [
  { id: "bookmark-one", userId: null, boardId: "board-one", title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: "a", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];

function workspace(overrides: Partial<WorkspaceData["settings"]> = {}): WorkspaceData {
  return {
    pages,
    boards,
    bookmarks,
    settings: {
      ...createDefaultSettings(),
      locale: "en",
      activePageId: "page-one",
      quickSaveDefaultPageId: "page-one",
      quickSaveDefaultBoardId: "board-one",
      ...overrides,
    },
  };
}

const backup = {
  format: "asterfold-backup",
  formatVersion: 3,
  exportVersion: "3.1.0",
  scope: "full",
  entities: { pages: [pages[0]], boards: [boards[0]], bookmarks: [bookmarks[0]], settings: [workspace().settings], wallpapers: [] },
} as unknown as AsterfoldBackup;
const htmlRecords: ImportRecord[] = [{ title: "Imported", url: "https://imported.example/", description: null, folderPath: ["Folder"] }];

function callbacks() {
  return { onClose: vi.fn(), onUpdated: vi.fn(), onError: vi.fn(), onOpenTrash: vi.fn() };
}

function renderSettings(overrides: Partial<Parameters<typeof SettingsDialog>[0]> = {}) {
  const handlers = callbacks();
  const props: Parameters<typeof SettingsDialog>[0] = { open: true, workspace: workspace(), ...handlers, ...overrides };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(SettingsDialog, props) }));
  return { ...view, handlers, props };
}

function openSection(name: string): void {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Settings" })).getByRole("button", { name }));
}

function importInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[accept*=".json"]')!;
}

function wallpaperInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[accept*="image/png"]')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditInvariants.mockResolvedValue([]);
  mocks.getWallpaper.mockResolvedValue(null);
  mocks.saveWallpaper.mockResolvedValue({ id: "upload-1", name: "wallpaper.webp" });
  mocks.updateSettings.mockResolvedValue(undefined);
  mocks.readSessionPrivacy.mockResolvedValue(true);
  mocks.writeSessionPrivacy.mockResolvedValue(undefined);
  mocks.createBackup.mockResolvedValue(backup);
  mocks.serializeBackup.mockReturnValue("backup-json");
  mocks.toNetscapeHtml.mockReturnValue("bookmarks-html");
  mocks.toMarkdown.mockReturnValue("bookmarks-markdown");
  mocks.importRecords.mockResolvedValue({ imported: 1, skippedDuplicates: 0, invalid: [] });
  mocks.restoreBackup.mockResolvedValue(undefined);
  mocks.parseBackupOffThread.mockResolvedValue(backup);
  mocks.parseHtmlOffThread.mockResolvedValue(htmlRecords);
  mocks.commandsGetAll.mockResolvedValue([{ name: "quick-save", shortcut: "Ctrl+Shift+S" }]);
  mocks.permissionRequest.mockResolvedValue(false);
  mocks.bookmarksGetTree.mockResolvedValue([]);
  mocks.tabsCreate.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "storage", { configurable: true, value: { estimate: vi.fn().mockResolvedValue({ usage: 2 * 1024 * 1024 }) } });
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
  vi.spyOn(window, "confirm").mockImplementation(confirmMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SettingsDialog appearance and navigation", () => {
  it("loads runtime metadata and changes every appearance control with a debounced commit", async () => {
    vi.useFakeTimers();
    const { handlers } = renderSettings();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Solid color" }));
    fireEvent.change(screen.getByDisplayValue(/^#/), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    for (const [name, value] of [
      ["Glass transparency", "30"],
      ["Blur", "12"],
      ["Wallpaper dimming", "20"],
      ["Wallpaper blur", "4"],
      ["Wallpaper saturation", "120"],
    ] as const) {
      const label = screen.getByText(name, { selector: "strong" }).closest("label");
      const slider = label?.querySelector<HTMLInputElement>('input[type="range"]');
      expect(slider).not.toBeNull();
      fireEvent.change(slider!, { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Smooth glass" }));
    for (const name of ["Bookmark hover", "Menus and dialogs", "Board rearranging", "All animations"] as const) {
      const control = screen.getByRole("checkbox", { name });
      fireEvent.click(control);
    }
    fireEvent.click(screen.getByRole("button", { name: "Quiet Aurora" }));
    fireEvent.click(screen.getByRole("button", { name: "No wallpaper" }));
    await act(async () => { vi.advanceTimersByTime(201); await Promise.resolve(); });
    expect(mocks.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: expect.any(Object) }));
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("flushes a pending theme when closing and maps commit failures", async () => {
    mocks.updateSettings.mockRejectedValue(new Error("settings"));
    const { handlers } = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(handlers.onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to update settings"));
  });

  it("loads uploaded wallpaper metadata and saves uploaded images", async () => {
    const wallpaper: Partial<Wallpaper> = { id: "upload-1", width: 1920, height: 1080, storedBytes: 2048 };
    mocks.getWallpaper.mockResolvedValue(wallpaper);
    const themed = workspace({ theme: { ...workspace().settings.theme, wallpaperId: "upload-1", backgroundMode: "wallpaper" } });
    const { container, handlers } = renderSettings({ workspace: themed });
    expect(await screen.findByText("1920 × 1080 · 2.0 KB")).toBeVisible();
    const file = new File(["image"], "wallpaper.png", { type: "image/png" });
    fireEvent.change(wallpaperInput(container), { target: { files: [file] } });
    await waitFor(() => expect(mocks.saveWallpaper).toHaveBeenCalledWith(file, "wallpaper.png"));

    mocks.saveWallpaper.mockRejectedValueOnce(new Error("wallpaper"));
    fireEvent.change(wallpaperInput(container), { target: { files: [file] } });
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Wallpaper could not be saved"));
  });

  it("routes layout, language and Quick Save settings", async () => {
    renderSettings();
    openSection("Layout");
    fireEvent.click(screen.getByRole("button", { name: "Free grid" }));
    fireEvent.click(screen.getByRole("button", { name: "One row" }));
    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ workspaceLayoutMode: "free" }));
    expect(mocks.updateSettings).toHaveBeenCalledWith({ workspaceRows: 1 });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ workspaceAlignment: "left" });

    openSection("Language");
    fireEvent.click(screen.getByRole("button", { name: "Русский" }));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ locale: "ru" }));

    openSection("Quick Save");
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Ctrl+Shift+S")).toBeVisible();
    const [defaultPage, defaultBoard] = screen.getAllByRole("combobox");
    fireEvent.change(defaultPage!, { target: { value: "page-two" } });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ quickSaveDefaultPageId: "page-two", quickSaveDefaultBoardId: "board-two" });
    fireEvent.change(defaultBoard!, { target: { value: "board-one" } });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ quickSaveDefaultBoardId: "board-one" });
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    expect(mocks.tabsCreate).toHaveBeenCalledWith({ url: "chrome://extensions/shortcuts" });
  });
});

describe("SettingsDialog exports and file imports", () => {
  it("exports JSON, HTML and Markdown and reports export failures", async () => {
    const { handlers } = renderSettings({ initialSection: "data-privacy" });
    for (const name of ["JSON backup", "HTML bookmarks", "Markdown"] as const) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
      await waitFor(() => expect(mocks.createBackup).toHaveBeenCalled());
    }
    expect(mocks.downloadText).toHaveBeenCalledWith(expect.stringMatching(/^asterfold-backup-v3-/), "backup-json", "application/json");
    expect(mocks.downloadText).toHaveBeenCalledWith("asterfold-bookmarks.html", "bookmarks-html", "text/html");
    expect(mocks.downloadText).toHaveBeenCalledWith("asterfold-bookmarks.md", "bookmarks-markdown", "text/markdown");
    expect(handlers.onUpdated).toHaveBeenCalledWith("JSON exported");

    mocks.createBackup.mockRejectedValueOnce(new Error("export"));
    fireEvent.click(screen.getByRole("button", { name: /JSON backup/ }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Export failed"));
  });

  it("previews and commits HTML records with page and duplicate choices", async () => {
    const { container, handlers } = renderSettings({ initialSection: "data-privacy" });
    const html = "<DL></DL>";
    const file = new File([html], "bookmarks.html", { type: "text/html" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(html) });
    fireEvent.change(importInput(container), { target: { files: [file] } });
    await waitFor(() => expect(mocks.parseHtmlOffThread).toHaveBeenCalled());
    expect(await screen.findByText("Bookmarks: 1. No changes written yet.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Default page"), { target: { value: "Imported Work" } });
    fireEvent.change(screen.getByLabelText("Duplicates"), { target: { value: "allow" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocks.importRecords).toHaveBeenCalledWith(htmlRecords, { pageTitle: "Imported Work" }, "allow"));
    expect(handlers.onUpdated).toHaveBeenCalledWith("Imported: 1");
    expect(screen.queryByText("bookmarks.html")).toBeNull();
  });

  it("cancels an HTML preview and reports import commit failures", async () => {
    const { container, handlers } = renderSettings({ initialSection: "data-privacy" });
    const file = new File(["html"], "bookmarks.html", { type: "text/html" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("html") });
    fireEvent.change(importInput(container), { target: { files: [file] } });
    await screen.findByText("Bookmarks: 1. No changes written yet.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Bookmarks: 1. No changes written yet.")).toBeNull();

    fireEvent.change(importInput(container), { target: { files: [file] } });
    await screen.findByText("Bookmarks: 1. No changes written yet.");
    mocks.importRecords.mockRejectedValueOnce(new Error("import"));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Import failed"));
  });

  it("previews JSON backups and executes merge and guarded replace", async () => {
    const { container, handlers } = renderSettings({ initialSection: "data-privacy" });
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("{}") });
    fireEvent.change(importInput(container), { target: { files: [file] } });
    expect(await screen.findByText(/v3\.1\.0 · 1 \/ 1 \/ 1/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(mocks.restoreBackup).toHaveBeenCalledWith(backup, "merge"));
    expect(handlers.onUpdated).toHaveBeenCalledWith("Backup restored");

    fireEvent.change(importInput(container), { target: { files: [file] } });
    await screen.findByRole("button", { name: "Replace" });
    confirmMock.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(mocks.restoreBackup).not.toHaveBeenCalledWith(backup, "replace");
    confirmMock.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(mocks.restoreBackup).toHaveBeenCalledWith(backup, "replace"));
  });

  it("maps backup restore failures and hides replace for partial backups", async () => {
    const partial = { ...backup, scope: "page" } as AsterfoldBackup;
    mocks.parseBackupOffThread.mockResolvedValue(partial);
    mocks.restoreBackup.mockRejectedValueOnce(new Error("restore"));
    const { container, handlers } = renderSettings({ initialSection: "data-privacy" });
    const file = new File(["{}"], "partial.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("{}") });
    fireEvent.change(importInput(container), { target: { files: [file] } });
    await screen.findByRole("button", { name: "Merge" });
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Restore failed"));
  });

  it("rejects oversized and invalid files while ignoring deliberate aborts", async () => {
    const { container, handlers } = renderSettings({ initialSection: "data-privacy" });
    const tooLarge = new File(["x"], "large.html", { type: "text/html" });
    Object.defineProperty(tooLarge, "size", { value: 30 * 1024 * 1024 });
    fireEvent.change(importInput(container), { target: { files: [tooLarge] } });
    expect(handlers.onError).toHaveBeenCalledWith("Import file must be 25 MB or smaller");

    const invalid = new File(["bad"], "bad.html", { type: "text/html" });
    Object.defineProperty(invalid, "text", { value: vi.fn().mockResolvedValue("bad") });
    mocks.parseHtmlOffThread.mockRejectedValueOnce(new Error("parse"));
    fireEvent.change(importInput(container), { target: { files: [invalid] } });
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Import preview failed"));

    let rejectParse: ((reason?: unknown) => void) | undefined;
    mocks.parseHtmlOffThread.mockImplementationOnce((_text: string, signal: AbortSignal) => new Promise((_, reject) => {
      rejectParse = reject;
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const pending = new File(["wait"], "wait.html", { type: "text/html" });
    Object.defineProperty(pending, "text", { value: vi.fn().mockResolvedValue("wait") });
    fireEvent.change(importInput(container), { target: { files: [pending] } });
    expect(await screen.findByRole("status")).toHaveTextContent("Checking the import file");
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    handlers.onError.mockClear();
    rejectParse?.(new DOMException("aborted", "AbortError"));
    expect(handlers.onError).not.toHaveBeenCalled();
  });
});

describe("SettingsDialog Chrome import, privacy and diagnostics", () => {
  it("handles denied, granted and failed Chrome bookmark permission requests", async () => {
    const { handlers } = renderSettings({ initialSection: "data-privacy" });
    fireEvent.click(screen.getByRole("button", { name: /Import from Chrome/ }));
    await waitFor(() => expect(mocks.permissionRequest).toHaveBeenCalledWith({ permissions: ["bookmarks"] }));
    expect(mocks.bookmarksGetTree).not.toHaveBeenCalled();

    mocks.permissionRequest.mockResolvedValueOnce(true);
    mocks.bookmarksGetTree.mockResolvedValueOnce([{ id: "root", title: "", children: [{ id: "folder", title: "Folder", children: [{ id: "link", title: "  ", url: "https://chrome.example/" }] }] }]);
    fireEvent.click(screen.getByRole("button", { name: /Import from Chrome/ }));
    expect(await screen.findByText("Bookmarks: 1. No changes written yet.")).toBeVisible();
    expect(screen.getByText("Chrome bookmarks")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    mocks.permissionRequest.mockRejectedValueOnce(new Error("permission"));
    fireEvent.click(screen.getByRole("button", { name: /Import from Chrome/ }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to read Chrome bookmarks"));
  });

  it("reports over-deep Chrome trees through the same import error boundary", async () => {
    let node: Record<string, unknown> = { id: "link", title: "Link", url: "https://example.com/" };
    for (let index = 0; index < 110; index += 1) node = { id: `folder-${index}`, title: `Folder ${index}`, children: [node] };
    mocks.permissionRequest.mockResolvedValue(true);
    mocks.bookmarksGetTree.mockResolvedValue([node]);
    const { handlers } = renderSettings({ initialSection: "data-privacy" });
    fireEvent.click(screen.getByRole("button", { name: /Import from Chrome/ }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to read Chrome bookmarks"));
  });

  it("enables and disables persistent privacy with session state", async () => {
    const enabled = renderSettings({ initialSection: "data-privacy", workspace: workspace({ privacyPersist: false, privacyEnabled: false }) });
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(mocks.readSessionPrivacy).toHaveBeenCalled());
    expect(mocks.updateSettings).toHaveBeenCalledWith({ privacyPersist: true, privacyEnabled: true });
    enabled.unmount();

    renderSettings({ initialSection: "data-privacy", workspace: workspace({ privacyPersist: true, privacyEnabled: true }) });
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(mocks.writeSessionPrivacy).toHaveBeenCalledWith(true));
    expect(mocks.updateSettings).toHaveBeenCalledWith({ privacyPersist: false, privacyEnabled: false });
  });

  it("maps privacy/settings failures and updates retention", async () => {
    mocks.readSessionPrivacy.mockRejectedValueOnce(new Error("session"));
    const { handlers } = renderSettings({ initialSection: "data-privacy" });
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to update settings"));

    const retention = screen.getByRole("combobox");
    fireEvent.change(retention, { target: { value: "never" } });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ trashRetentionDays: null });
    fireEvent.change(retention, { target: { value: "90" } });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ trashRetentionDays: 90 });
  });

  it("renders storage/invariant diagnostics, opens Trash and repeats diagnostics once", async () => {
    mocks.auditInvariants.mockResolvedValueOnce(["broken relation"]);
    let finish: ((value: string[]) => void) | undefined;
    const { handlers } = renderSettings({ initialSection: "data-privacy" });
    expect(await screen.findByText("2.0 MB")).toBeVisible();
    expect(await screen.findByText("Issues: 1")).toHaveClass("is-warning");
    expect(screen.getByText("2 / 2 / 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open trash" }));
    expect(handlers.onOpenTrash).toHaveBeenCalledOnce();

    mocks.auditInvariants.mockImplementationOnce(() => new Promise<string[]>((resolve) => { finish = resolve; }));
    const repeat = screen.getByRole("button", { name: "Repeat diagnostics" });
    fireEvent.click(repeat);
    fireEvent.click(repeat);
    expect(mocks.auditInvariants).toHaveBeenCalledTimes(2);
    expect(repeat).toBeDisabled();
    act(() => { finish?.([]); });
    await waitFor(() => expect(handlers.onUpdated).toHaveBeenCalledWith("Diagnostics repeated"));
    expect(repeat).not.toBeDisabled();
  });

  it("maps diagnostics and startup metadata failures", async () => {
    mocks.commandsGetAll.mockRejectedValueOnce(new Error("commands"));
    Object.defineProperty(navigator, "storage", { configurable: true, value: { estimate: vi.fn().mockRejectedValue(new Error("storage")) } });
    mocks.auditInvariants.mockRejectedValue(new Error("audit"));
    const { handlers } = renderSettings({ initialSection: "data-privacy" });
    await waitFor(() => expect(screen.getAllByText("—").length).toBeGreaterThan(0));
    expect(screen.getByText("Workspace checks passed")).toBeVisible();
    mocks.auditInvariants.mockRejectedValueOnce(new Error("repeat"));
    fireEvent.click(screen.getByRole("button", { name: "Repeat diagnostics" }));
    await waitFor(() => expect(handlers.onError).toHaveBeenCalledWith("Unable to complete the action"));
  });
});
