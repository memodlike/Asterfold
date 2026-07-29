import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { AppSettings, Board, Bookmark, Page, WorkspaceData } from "../src/domain/models";
import type { AsterfoldBackup } from "../src/services/exportImport";

const confirmMock = vi.fn(() => true);

const mocks = vi.hoisted(() => ({
  auditInvariants: vi.fn(),
  getWallpaper: vi.fn(),
  saveWallpaper: vi.fn(),
  updateSettings: vi.fn(),
  createBackup: vi.fn(),
  downloadText: vi.fn(),
  importRecords: vi.fn(),
  restoreBackup: vi.fn(),
  serializeBackup: vi.fn(),
  toMarkdown: vi.fn(),
  toNetscapeHtml: vi.fn(),
  parseBackupOffThread: vi.fn(),
  parseHtmlOffThread: vi.fn(),
  readSessionPrivacy: vi.fn(),
  writeSessionPrivacy: vi.fn(),
  commandsGetAll: vi.fn(),
  permissionsRequest: vi.fn(),
  bookmarksGetTree: vi.fn(),
  tabsCreate: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    commands: { getAll: mocks.commandsGetAll },
    permissions: { request: mocks.permissionsRequest },
    bookmarks: { getTree: mocks.bookmarksGetTree },
    tabs: { create: mocks.tabsCreate },
  },
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
vi.mock("../src/browser/privacySession", () => ({
  readSessionPrivacy: mocks.readSessionPrivacy,
  writeSessionPrivacy: mocks.writeSessionPrivacy,
}));

import { SettingsDialog } from "../src/features/settings/SettingsDialog";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const page: Page = { id: "page", userId: null, title: "Work", icon: null, accent: null, position: "0001", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const pageTwo: Page = { ...page, id: "page-two", title: "Personal", position: "0002", isDefault: false };
const board: Board = { id: "board", userId: null, pageId: page.id, title: "Inbox", icon: null, accent: null, position: "0001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const boardTwo: Board = { ...board, id: "board-two", pageId: pageTwo.id, title: "Later", position: "0002" };
const bookmark: Bookmark = { id: "bookmark", userId: null, boardId: board.id, title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: "Reference", faviconUrl: null, customIcon: null, position: "0001", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...createDefaultSettings(),
    activePageId: page.id,
    quickSaveDefaultPageId: page.id,
    quickSaveDefaultBoardId: board.id,
    ...overrides,
  };
}

function workspace(overrides: Partial<AppSettings> = {}): WorkspaceData {
  return { pages: [page, pageTwo], boards: [board, boardTwo], bookmarks: [bookmark], settings: settings(overrides) };
}

function backup(scope: AsterfoldBackup["scope"] = "full"): AsterfoldBackup {
  const current = settings();
  return {
    schemaVersion: 3,
    exportVersion: 3,
    exportedAt: timestamp,
    appVersion: "3.0.1",
    scope,
    entities: { pages: [page], boards: [board], bookmarks: [bookmark] },
    ...(scope === "full" ? { settings: current, theme: current.theme, assets: { wallpapers: [] } } : { assets: { wallpapers: [] } }),
  };
}

function renderSettings(options: { workspace?: WorkspaceData; initialSection?: "appearance" | "layout" | "language" | "quick-save" | "data-privacy" } = {}) {
  const callbacks = { onClose: vi.fn(), onUpdated: vi.fn(), onError: vi.fn(), onOpenTrash: vi.fn() };
  const view = render(createElement(I18nProvider, {
    preference: "en",
    children: createElement(SettingsDialog, {
      open: true,
      workspace: options.workspace ?? workspace(),
      ...callbacks,
      ...(options.initialSection ? { initialSection: options.initialSection } : {}),
    }),
  }));
  return { ...view, callbacks };
}

function importInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[accept*=".json"]');
  if (!input) throw new Error("Import input missing");
  return input;
}

function wallpaperInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[accept*="image/webp"]');
  if (!input) throw new Error("Wallpaper input missing");
  return input;
}

function fileWithText(name: string, text: string, type: string): File {
  const file = new File([text], name, { type });
  Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(text) });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditInvariants.mockResolvedValue([]);
  mocks.getWallpaper.mockResolvedValue(null);
  mocks.saveWallpaper.mockResolvedValue({ id: "upload-1", width: 1920, height: 1080, storedBytes: 4096 });
  mocks.updateSettings.mockResolvedValue(undefined);
  mocks.createBackup.mockResolvedValue(backup());
  mocks.serializeBackup.mockReturnValue("{\"backup\":true}");
  mocks.toNetscapeHtml.mockReturnValue("<DL></DL>");
  mocks.toMarkdown.mockReturnValue("# Bookmarks");
  mocks.importRecords.mockResolvedValue({ imported: 2, skippedDuplicates: 0, invalid: [] });
  mocks.restoreBackup.mockResolvedValue(undefined);
  mocks.parseBackupOffThread.mockResolvedValue(backup());
  mocks.parseHtmlOffThread.mockResolvedValue([
    { title: "Example", url: "https://example.com/", description: null, folderPath: [] },
    { title: "Docs", url: "https://example.com/docs", description: "Docs", folderPath: ["Work"] },
  ]);
  mocks.readSessionPrivacy.mockResolvedValue(true);
  mocks.writeSessionPrivacy.mockResolvedValue(undefined);
  mocks.commandsGetAll.mockResolvedValue([{ name: "quick-save", shortcut: "Ctrl+Shift+Y" }]);
  mocks.permissionsRequest.mockResolvedValue(false);
  mocks.bookmarksGetTree.mockResolvedValue([]);
  Object.defineProperty(navigator, "storage", { configurable: true, value: { estimate: vi.fn().mockResolvedValue({ usage: 1536, quota: 10_000 }) } });
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
  vi.stubGlobal("confirm", confirmMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SettingsDialog behavior", () => {
  it("commits appearance controls, uploaded wallpaper metadata, and close state", async () => {
    mocks.getWallpaper.mockResolvedValue({ id: "builtin-aurora", width: 1920, height: 1080, storedBytes: 2048 });
    const { container, callbacks } = renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ theme: expect.objectContaining({ mode: "dark" }) }));

    fireEvent.click(screen.getByRole("button", { name: "Solid color" }));
    await waitFor(() => expect(screen.getByText("Background color")).toBeVisible());
    fireEvent.change(container.querySelector('input[type="color"]')!, { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.change(screen.getByLabelText("Glass transparency"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Blur"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Wallpaper dimming"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Wallpaper blur"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Wallpaper saturation"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Quiet Aurora" }));
    await waitFor(() => expect(mocks.getWallpaper).toHaveBeenCalledWith("builtin-aurora"));
    expect(await screen.findByText(/1920 × 1080/)).toBeVisible();

    fireEvent.click(screen.getByLabelText("Low-power mode"));
    fireEvent.click(screen.getByLabelText("All animations"));
    await waitFor(() => expect(screen.queryByLabelText("Bookmark hover")).toBeNull());

    const image = fileWithText("wallpaper.webp", "image", "image/webp");
    fireEvent.change(wallpaperInput(container), { target: { files: [image] } });
    await waitFor(() => expect(mocks.saveWallpaper).toHaveBeenCalledWith(image, "wallpaper.webp"));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ theme: expect.objectContaining({ wallpaperId: "upload-1", backgroundMode: "wallpaper" }) }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });

  it("updates layout, language, Quick Save destinations, and shortcut settings", async () => {
    const { container, callbacks } = renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Free grid" }));
    fireEvent.click(screen.getByRole("button", { name: "One row" }));
    fireEvent.click(screen.getByRole("button", { name: "Right" }));
    await waitFor(() => {
      expect(mocks.updateSettings).toHaveBeenCalledWith({ workspaceLayoutMode: "free" });
      expect(mocks.updateSettings).toHaveBeenCalledWith({ workspaceRows: 1 });
      expect(mocks.updateSettings).toHaveBeenCalledWith({ workspaceAlignment: "right" });
    });

    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.click(screen.getByRole("button", { name: "Русский" }));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ locale: "ru" }));

    fireEvent.click(screen.getByRole("button", { name: "Quick Save" }));
    expect(screen.getByText("Ctrl+Shift+Y")).toBeVisible();
    const selects = [...container.querySelectorAll<HTMLSelectElement>("select")];
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[0]!, { target: { value: pageTwo.id } });
    fireEvent.change(selects[1]!, { target: { value: board.id } });
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    await waitFor(() => {
      expect(mocks.updateSettings).toHaveBeenCalledWith({ quickSaveDefaultPageId: pageTwo.id, quickSaveDefaultBoardId: boardTwo.id });
      expect(mocks.updateSettings).toHaveBeenCalledWith({ quickSaveDefaultBoardId: board.id });
      expect(mocks.tabsCreate).toHaveBeenCalledWith({ url: "chrome://extensions/shortcuts" });
    });
    expect(callbacks.onUpdated).toHaveBeenCalled();
  });

  it("exports all formats, imports Chrome bookmarks, persists privacy, and repeats diagnostics", async () => {
    mocks.auditInvariants.mockResolvedValueOnce(["orphan"]).mockResolvedValueOnce([]);
    mocks.permissionsRequest.mockResolvedValue(true);
    mocks.bookmarksGetTree.mockResolvedValue([
      { id: "0", title: "", children: [{ id: "1", title: "Work", children: [{ id: "2", title: "Example", url: "https://example.com/" }] }] },
    ]);
    const { container, callbacks } = renderSettings({ initialSection: "data-privacy" });

    expect(await screen.findByText("Issues: 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /JSON backup/ }));
    fireEvent.click(screen.getByRole("button", { name: /HTML bookmarks/ }));
    fireEvent.click(screen.getByRole("button", { name: /Markdown/ }));
    await waitFor(() => expect(mocks.downloadText).toHaveBeenCalledTimes(3));
    expect(mocks.downloadText).toHaveBeenNthCalledWith(1, expect.stringMatching(/^asterfold-backup-v3-/), "{\"backup\":true}", "application/json");
    expect(mocks.downloadText).toHaveBeenNthCalledWith(2, "asterfold-bookmarks.html", "<DL></DL>", "text/html");
    expect(mocks.downloadText).toHaveBeenNthCalledWith(3, "asterfold-bookmarks.md", "# Bookmarks", "text/markdown");

    fireEvent.click(screen.getByRole("button", { name: /Import from Chrome/ }));
    await waitFor(() => expect(mocks.bookmarksGetTree).toHaveBeenCalledOnce());
    expect(await screen.findByText("Bookmarks: 1. No changes written yet.")).toBeVisible();
    const textInput = container.querySelector<HTMLInputElement>('.import-preview input[maxlength="240"]')!;
    fireEvent.change(textInput, { target: { value: "Chrome import" } });
    fireEvent.change(container.querySelector<HTMLSelectElement>(".import-preview select")!, { target: { value: "allow" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocks.importRecords).toHaveBeenCalledWith(expect.any(Array), { pageTitle: "Chrome import" }, "allow"));

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ privacyPersist: true, privacyEnabled: true }));
    const retention = container.querySelector<HTMLSelectElement>('.setting-row select')!;
    fireEvent.change(retention, { target: { value: "never" } });
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith({ trashRetentionDays: null }));

    fireEvent.click(screen.getByRole("button", { name: "Open trash" }));
    expect(callbacks.onOpenTrash).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Repeat diagnostics" }));
    await waitFor(() => expect(callbacks.onUpdated).toHaveBeenCalledWith("Diagnostics repeated"));
    expect(screen.getByText("Workspace checks passed")).toBeVisible();
  });

  it("parses HTML and JSON files, restores backups, cancels replace, and rejects oversized input", async () => {
    const { container, callbacks } = renderSettings({ initialSection: "data-privacy" });
    const input = importInput(container);

    const html = fileWithText("bookmarks.html", "<DL></DL>", "text/html");
    fireEvent.change(input, { target: { files: [html] } });
    expect(await screen.findByText("Bookmarks: 2. No changes written yet.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Bookmarks: 2. No changes written yet.")).toBeNull();

    const json = fileWithText("backup.json", "{}", "application/json");
    fireEvent.change(input, { target: { files: [json] } });
    expect(await screen.findByText("v3 · 1 / 1 / 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(mocks.restoreBackup).toHaveBeenCalledWith(expect.objectContaining({ scope: "full" }), "merge"));

    fireEvent.change(input, { target: { files: [json] } });
    expect(await screen.findByRole("button", { name: "Replace" })).toBeVisible();
    confirmMock.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(mocks.restoreBackup).toHaveBeenCalledTimes(1);
    confirmMock.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(mocks.restoreBackup).toHaveBeenCalledWith(expect.objectContaining({ scope: "full" }), "replace"));

    const oversized = fileWithText("large.html", "x", "text/html");
    Object.defineProperty(oversized, "size", { value: 26 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(callbacks.onError).toHaveBeenCalledWith("Import file must be 25 MB or smaller");
  });

  it("surfaces update, export, import, Chrome, wallpaper, restore, and diagnostics failures", async () => {
    const { container, callbacks } = renderSettings();

    mocks.updateSettings.mockRejectedValueOnce(new Error("settings"));
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Free grid" }));
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Unable to update settings"));

    fireEvent.click(screen.getByRole("button", { name: "Data & privacy" }));
    mocks.createBackup.mockRejectedValueOnce(new Error("export"));
    fireEvent.click(screen.getByRole("button", { name: /JSON backup/ }));
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Export failed"));

    mocks.permissionsRequest.mockRejectedValueOnce(new Error("permission"));
    fireEvent.click(screen.getByRole("button", { name: /Import from Chrome/ }));
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Unable to read Chrome bookmarks"));

    mocks.parseHtmlOffThread.mockRejectedValueOnce(new Error("parse"));
    fireEvent.change(importInput(container), { target: { files: [fileWithText("bad.html", "bad", "text/html")] } });
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Import preview failed"));

    mocks.parseHtmlOffThread.mockResolvedValueOnce([{ title: "Example", url: "https://example.com/", description: null, folderPath: [] }]);
    fireEvent.change(importInput(container), { target: { files: [fileWithText("bookmarks.html", "ok", "text/html")] } });
    expect(await screen.findByText("Bookmarks: 1. No changes written yet.")).toBeVisible();
    mocks.importRecords.mockRejectedValueOnce(new Error("import"));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Import failed"));

    mocks.parseBackupOffThread.mockResolvedValueOnce(backup());
    fireEvent.change(importInput(container), { target: { files: [fileWithText("backup.json", "{}", "application/json")] } });
    expect(await screen.findByText("v3 · 1 / 1 / 1")).toBeVisible();
    mocks.restoreBackup.mockRejectedValueOnce(new Error("restore"));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Restore failed"));

    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    mocks.saveWallpaper.mockRejectedValueOnce(new Error("wallpaper"));
    fireEvent.change(wallpaperInput(container), { target: { files: [fileWithText("wallpaper.webp", "image", "image/webp")] } });
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Wallpaper could not be saved"));

    fireEvent.click(screen.getByRole("button", { name: "Data & privacy" }));
    mocks.auditInvariants.mockRejectedValueOnce(new Error("diagnostics"));
    fireEvent.click(screen.getByRole("button", { name: "Repeat diagnostics" }));
    await waitFor(() => expect(callbacks.onError).toHaveBeenCalledWith("Unable to complete the action"));
  });

  it("writes the current privacy state when persistence is disabled", async () => {
    const { callbacks } = renderSettings({ workspace: workspace({ privacyPersist: true, privacyEnabled: true }), initialSection: "data-privacy" });
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(mocks.writeSessionPrivacy).toHaveBeenCalledWith(true);
      expect(mocks.updateSettings).toHaveBeenCalledWith({ privacyPersist: false, privacyEnabled: false });
      expect(callbacks.onUpdated).toHaveBeenCalledWith("Save");
    });
  });
});
