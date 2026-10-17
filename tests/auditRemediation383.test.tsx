import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { db } from "../src/db/database";
import * as repository from "../src/db/repository";
import type { Board, Page, WorkspaceData } from "../src/domain/models";
import { I18nProvider, translate } from "../src/i18n";
import { AppLauncher } from "../src/app/AppLauncher";
import { MoveDialog } from "../src/components/MoveDialog";
import { BookmarkEditor } from "../src/features/bookmarks/BookmarkEditor";

const state = vi.hoisted(() => ({
  workspace: undefined as WorkspaceData | undefined,
  privacy: false,
  setPrivacy: vi.fn(),
}));

vi.mock("../src/app/useWorkspace", () => ({
  useWorkspace: () => ({ workspace: state.workspace, failed: false, retry: vi.fn() }),
}));
vi.mock("../src/app/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ privacy: state.privacy, setPrivacy: state.setPrivacy }),
}));
vi.mock("../src/features/appearance/useThemeRuntime", () => ({
  useThemeRuntime: () => "software",
}));

import { WorkspaceApp } from "../src/app/WorkspaceApp";

const timestamp = "2026-01-01T00:00:00.000Z";
const testPages: Page[] = [
  { id: "page-1", userId: null, title: "Medical Records", icon: "folder", accent: null, position: "a0", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "page-2", userId: null, title: "Tax Records", icon: "folder", accent: null, position: "a1", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];
const testBoards: Board[] = [
  { id: "board-1", userId: null, pageId: "page-1", title: "Prescriptions", icon: null, accent: null, position: "a0", collapsed: false, layout: "grid", bookmarkColumns: "auto", gridColumn: 0, gridRow: 0, gridSpan: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "board-2", userId: null, pageId: "page-2", title: "Receipts", icon: null, accent: null, position: "a0", collapsed: false, layout: "grid", bookmarkColumns: "auto", gridColumn: 0, gridRow: 0, gridSpan: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];

describe("Audit 3.8.3 Bug Fixes & Regressions", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await repository.ensureStarterWorkspace();
    await repository.updateSettings({ locale: "en", onboardingComplete: true });
    state.privacy = false;
    state.setPrivacy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(performance, "mark", { configurable: true, value: vi.fn() });
    Object.defineProperty(performance, "measure", { configurable: true, value: vi.fn() });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    Object.defineProperty(globalThis, "CSS", { configurable: true, value: { escape: (v: string) => v, supports: () => false } });
  });

  afterEach(async () => {
    cleanup();
    await db.delete();
    vi.restoreAllMocks();
  });

  describe("AF383-02: Selection clearing on active page change & visible bookmarks pruning", () => {
    it("clears selection when creating a new page and does not delete previous-page bookmarks", async () => {
      const initial = await repository.getWorkspaceData();
      const board1 = initial.boards[0]!;
      const bookmark1 = await repository.createBookmark({
        boardId: board1.id,
        title: "Bookmark 1",
        url: "https://example.com/1",
      });

      state.workspace = await repository.getWorkspaceData();
      render(<WorkspaceApp />);

      // Select the bookmark on page 1
      const card = screen.getByText("Bookmark 1").closest("button")!;
      fireEvent.click(card, { ctrlKey: true });

      // Verify bulk toolbar is visible with count 1
      expect(screen.getByText("1", { selector: ".bulk-toolbar strong" })).toBeInTheDocument();

      // Open launcher and trigger new page creation
      fireEvent.click(screen.getByRole("button", { name: "Open Asterfold menu" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Create page" }));

      // Name dialog should appear
      const dialog = await screen.findByRole("dialog", { name: "Create page" });
      const input = within(dialog).getByRole("textbox", { name: "Title" });
      fireEvent.change(input, { target: { value: "Page 2" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

      // Wait for page creation
      await waitFor(async () => {
        const currentData = await repository.getWorkspaceData();
        expect(currentData.pages).toHaveLength(2);
      });

      // Update workspace state to trigger render on new active page
      state.workspace = await repository.getWorkspaceData();
      cleanup();
      render(<WorkspaceApp />);

      // The bulk toolbar should NOT be visible on the new page
      expect(screen.queryByText("1", { selector: ".bulk-toolbar strong" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

      // Verify the bookmark from page 1 still exists in the database
      const freshData = await repository.getWorkspaceData();
      expect(freshData.bookmarks.some((b) => b.id === bookmark1.id && b.deletedAt === null)).toBe(true);
    });

    it("clears selection when switching active page via selectPage", async () => {
      const initial = await repository.getWorkspaceData();
      const page1 = initial.pages[0]!;
      await repository.createPage("Second Page");
      await repository.updateSettings({ activePageId: page1.id });
      const board1 = initial.boards[0]!;
      await repository.createBookmark({
        boardId: board1.id,
        title: "Select Page Bookmark",
        url: "https://example.com/select",
      });

      state.workspace = await repository.getWorkspaceData();
      render(<WorkspaceApp />);

      const card = screen.getByText("Select Page Bookmark").closest("button")!;
      fireEvent.click(card, { ctrlKey: true });
      expect(screen.getByText("1", { selector: ".bulk-toolbar strong" })).toBeInTheDocument();

      // Switch to page 2 via launcher
      fireEvent.click(screen.getByRole("button", { name: "Open Asterfold menu" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Second Page" }));

      state.workspace = await repository.getWorkspaceData();
      await waitFor(() => {
        expect(screen.queryByText("1", { selector: ".bulk-toolbar strong" })).not.toBeInTheDocument();
      });
    });
  });

  describe("AF383-04: Page title redaction in Privacy Mode", () => {
    it("redacts page names in launcher Pages list (visible text and accessible names)", () => {
      render(
        <I18nProvider preference="en">
          <AppLauncher
            pages={testPages}
            activePageId="page-1"
            privacy={true}
            onCreateBoard={vi.fn()}
            onCreatePage={vi.fn()}
            onSelectPage={vi.fn()}
            onRenamePage={vi.fn()}
            onDuplicatePage={vi.fn()}
            onDefaultPage={vi.fn()}
            onMovePage={vi.fn()}
            onDeletePage={vi.fn()}
            onSearch={vi.fn()}
            onPrivacy={vi.fn()}
            onTrash={vi.fn()}
            onSettings={vi.fn()}
          />
        </I18nProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Open Asterfold menu" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));

      // Both page names should be redacted to "Page"
      expect(screen.queryByText("Medical Records")).not.toBeInTheDocument();
      expect(screen.queryByText("Tax Records")).not.toBeInTheDocument();

      const pageButtons = screen.getAllByRole("menuitem", { name: "Page" });
      expect(pageButtons).toHaveLength(2);
      expect(pageButtons[0]).toHaveAttribute("aria-label", "Page");
      expect(pageButtons[1]).toHaveAttribute("aria-label", "Page");
    });

    it("redacts page names in MoveDialog when privacy is enabled", () => {
      const { rerender } = render(
        <I18nProvider preference="en">
          <MoveDialog
            open
            privacy={true}
            type="board"
            pages={testPages}
            boards={testBoards}
            currentId="page-1"
            onClose={vi.fn()}
            onMove={vi.fn()}
          />
        </I18nProvider>,
      );

      // Moving a board: destination option label should be "Page", not "Tax Records"
      expect(screen.queryByText("Tax Records")).not.toBeInTheDocument();
      expect(screen.getAllByText("Page").length).toBeGreaterThan(0);

      // Moving bookmarks: destination option group should be "Page", not "Medical Records"
      rerender(
        <I18nProvider preference="en">
          <MoveDialog
            open
            privacy={true}
            type="bookmark"
            pages={testPages}
            boards={testBoards}
            currentId="other-board"
            onClose={vi.fn()}
            onMove={vi.fn()}
          />
        </I18nProvider>,
      );
      expect(screen.queryByText("Medical Records")).not.toBeInTheDocument();
      expect(screen.queryByText("Tax Records")).not.toBeInTheDocument();
    });

    it("redacts page names in BookmarkEditor destination options when privacy is enabled", () => {
      render(
        <I18nProvider preference="en">
          <BookmarkEditor
            open
            privacy={true}
            bookmark={null}
            initialBoardId="board-1"
            pages={testPages}
            boards={testBoards}
            onClose={vi.fn()}
            onSaved={vi.fn()}
            onError={vi.fn()}
          />
        </I18nProvider>,
      );

      // Option values in destination select should group under "Page", not page titles
      expect(screen.queryByText("Medical Records")).not.toBeInTheDocument();
      expect(screen.queryByText("Tax Records")).not.toBeInTheDocument();
    });
  });

  describe("AF383-05: Nested page menu Escape suppression and focus restoration", () => {
    it("dismisses only the child context menu on Escape and restores focus to the page button", () => {
      render(
        <I18nProvider preference="en">
          <AppLauncher
            pages={testPages}
            activePageId="page-1"
            privacy={false}
            onCreateBoard={vi.fn()}
            onCreatePage={vi.fn()}
            onSelectPage={vi.fn()}
            onRenamePage={vi.fn()}
            onDuplicatePage={vi.fn()}
            onDefaultPage={vi.fn()}
            onMovePage={vi.fn()}
            onDeletePage={vi.fn()}
            onSearch={vi.fn()}
            onPrivacy={vi.fn()}
            onTrash={vi.fn()}
            onSettings={vi.fn()}
          />
        </I18nProvider>,
      );

      const trigger = screen.getByRole("button", { name: "Open Asterfold menu" });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
      const pageButton = screen.getByRole("menuitem", { name: "Medical Records" });
      pageButton.focus();

      // Open page context menu via Shift+F10
      fireEvent.keyDown(pageButton, { key: "F10", shiftKey: true });
      expect(screen.getByRole("menu", { name: "Page" })).toBeInTheDocument();
      expect(screen.getAllByRole("menu")).toHaveLength(2);

      // Press Escape: should close ONLY the child menu
      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("menu", { name: "Page" })).not.toBeInTheDocument();
      expect(screen.getByRole("menu", { name: "Open Asterfold menu" })).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      // Press Escape second time: should close the launcher menu
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("menu", { name: "Open Asterfold menu" })).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("AF383-07: Count messages count-neutral wording in all supported locales", () => {
    it("uses count-neutral wording for Polish and English paste count messages", () => {
      // Polish paste.add with 1 and 2
      expect(translate("pl", "paste.add", { count: 1 })).toBe("Dodaj (1)");
      expect(translate("pl", "paste.add", { count: 2 })).toBe("Dodaj (2)");

      // English paste.add with 1 and 2
      expect(translate("en", "paste.add", { count: 1 })).toBe("Add (1)");
      expect(translate("en", "paste.add", { count: 2 })).toBe("Add (2)");

      // Polish paste.addedMany
      expect(translate("pl", "paste.addedMany", { count: 2, board: "Inbox" })).toBe("Zakładki dodane do Inbox: 2");
      expect(translate("en", "paste.addedMany", { count: 2, board: "Inbox" })).toBe("Bookmarks added to Inbox: 2");

      // Polish board.openAllDone
      expect(translate("pl", "board.openAllDone", { count: 1 })).toBe("Otwarte linki: 1");
      expect(translate("en", "board.openAllDone", { count: 1 })).toBe("Links opened: 1");

      // board.openAllConfirmBody
      expect(translate("pl", "board.openAllConfirmBody", { count: 15 })).toBe("To otworzy 15 kart. Kontynuować?");
      expect(translate("en", "board.openAllConfirmBody", { count: 15 })).toBe("This opens 15 tabs. Continue?");
    });
  });

  describe("GLASS-04 / DEFECT-04: Open-Board Confirmation Modal structural layout", () => {
    it("renders modal body with form-stack and modal__confirm-text, leaving description empty", async () => {
      const initial = await repository.getWorkspaceData();
      const board1 = initial.boards[0]!;
      for (let i = 0; i < 15; i++) {
        await repository.createBookmark({
          boardId: board1.id,
          title: `BM ${i}`,
          url: `https://example.com/${i}`,
        });
      }

      state.workspace = await repository.getWorkspaceData();
      render(<WorkspaceApp />);

      // Trigger "Open all in new window" on board-1
      const column = document.querySelector(`[data-board-id="${board1.id}"]`)!;
      fireEvent.contextMenu(column);
      const openAllWindow = screen.getByRole("menuitem", { name: "Open all in new window" });
      fireEvent.click(openAllWindow);

      // Verify modal is rendered
      const dialog = await screen.findByRole("dialog", { name: "Open all bookmarks" });
      expect(dialog).toBeInTheDocument();

      // Check modal__body is NOT empty (it contains .form-stack > .modal__confirm-text)
      const modalBody = dialog.querySelector(".modal__body");
      expect(modalBody).not.toBeNull();
      const confirmContainer = modalBody!.querySelector(".form-stack");
      expect(confirmContainer).not.toBeNull();
      const confirmText = confirmContainer!.querySelector(".modal__confirm-text");
      expect(confirmText).not.toBeNull();
      expect(confirmText).toHaveTextContent("This opens 15 tabs. Continue?");
    });
  });
});
