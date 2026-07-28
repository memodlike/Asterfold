import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { WorkspaceData } from "../src/domain/models";

const mocks = vi.hoisted(() => ({
  auditInvariants: vi.fn().mockResolvedValue([]),
  getWallpaper: vi.fn().mockResolvedValue(null),
  saveWallpaper: vi.fn(),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  parseBackupOffThread: vi.fn(),
  parseHtmlOffThread: vi.fn().mockResolvedValue([{ title: "Example", url: "https://example.com/", description: null, folderPath: [] }]),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    commands: { getAll: vi.fn().mockResolvedValue([]) },
    permissions: { request: vi.fn().mockResolvedValue(false) },
    bookmarks: { getTree: vi.fn().mockResolvedValue([]) },
    tabs: { create: vi.fn() },
    storage: { session: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) } },
  },
}));
vi.mock("../src/db/repository", () => ({
  auditInvariants: mocks.auditInvariants,
  getWallpaper: mocks.getWallpaper,
  saveWallpaper: mocks.saveWallpaper,
  updateSettings: mocks.updateSettings,
}));
vi.mock("../src/services/importWorker", () => ({
  parseBackupOffThread: mocks.parseBackupOffThread,
  parseHtmlOffThread: mocks.parseHtmlOffThread,
}));

import { SettingsDialog } from "../src/features/settings/SettingsDialog";
import { I18nProvider } from "../src/i18n";

const workspace: WorkspaceData = { pages: [], boards: [], bookmarks: [], settings: createDefaultSettings() };

describe("Settings import state", () => {
  it("keeps Data & privacy active when an import preview finishes parsing", async () => {
    const view = render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(SettingsDialog, {
        open: true,
        workspace,
        onClose: vi.fn(),
        onUpdated: vi.fn(),
        onError: vi.fn(),
        onOpenTrash: vi.fn(),
      }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Data & privacy" }));
    expect(screen.getByRole("heading", { name: "Data & privacy" })).toBeVisible();

    const input = view.container.querySelector<HTMLInputElement>('input[accept*=".json"]');
    expect(input).not.toBeNull();
    const file = new File(["<DL><DT><A HREF=\"https://example.com/\">Example</A></DL>"], "bookmarks.html", { type: "text/html" });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("Bookmarks: 1. No changes written yet.")).toBeVisible());
    expect(screen.getByRole("heading", { name: "Data & privacy" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Appearance" })).toBeNull();
  });
});
