import { createElement, useState, type FormEvent } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../src/components/Button";
import { Modal } from "../src/components/Modal";
import { SelectField } from "../src/components/SelectField";
import { FloatingContextMenu } from "../src/components/FloatingContextMenu";
import { useToasts } from "../src/components/ToastRegion";
import { SearchPalette } from "../src/features/search/SearchPalette";
import { I18nProvider } from "../src/i18n";
import type { Board, Bookmark, Page } from "../src/domain/models";

function ToastHarness() {
  const toasts = useToasts();
  return createElement("div", null,
    createElement("button", { onClick: () => toasts.push({ message: "Removed", actionLabel: "Undo", onAction: vi.fn() }) }, "Show"),
    toasts.region,
  );
}

const timestamp = "2026-01-01T00:00:00.000Z";
const page: Page = { id: "page", userId: null, title: "Workspace", icon: null, accent: null, position: "000000000001", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const board: Board = { id: "board", userId: null, pageId: page.id, title: "Inbox", icon: null, accent: null, position: "000000000001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const bookmark: Bookmark = { id: "bookmark", userId: null, boardId: board.id, title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: "Reference", faviconUrl: null, customIcon: null, position: "000000000001", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };

afterEach(() => {
  vi.useRealTimers();
});

describe("interaction regressions", () => {
  it("does not submit a containing form from a reusable Button unless explicitly requested", () => {
    const submit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(createElement("form", { onSubmit: submit }, createElement(Button, null, "Cancel")));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps focus inside the modal when no visible tabbable controls remain", () => {
    render(createElement(Modal, { open: true, title: "Information", onClose: vi.fn(), children: createElement("p", null, "Read only") }));
    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog).toHaveFocus();
  });

  it("does not resume toast expiry while keyboard focus remains inside the toast", async () => {
    vi.useFakeTimers();
    render(createElement(I18nProvider, { preference: "en", children: createElement(ToastHarness) }));
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    const undo = screen.getByRole("button", { name: "Undo" });
    undo.focus();
    const toast = undo.closest(".toast");
    expect(toast).not.toBeNull();
    fireEvent.pointerEnter(toast!);
    fireEvent.pointerLeave(toast!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    expect(screen.getByText("Removed")).toBeVisible();
  });

  it("does not activate a search result when Enter is pressed on a filter control", () => {
    const onOpen = vi.fn();
    render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(SearchPalette, {
        open: true,
        privacy: false,
        pages: [page],
        boards: [board],
        bookmarks: [bookmark],
        activePageId: page.id,
        onClose: vi.fn(),
        onOpen,
        onReveal: vi.fn(),
        onEdit: vi.fn(),
        onMove: vi.fn(),
        onCopy: vi.fn(),
        onDelete: vi.fn(),
      }),
    }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Example" } });
    const exact = screen.getByRole("button", { name: "Exact" });
    exact.focus();
    fireEvent.keyDown(exact, { key: "Enter" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("sanitizes sensitive toast text when privacy mode is enabled after push", () => {
    function PrivacyToastHarness({ privacy }: { privacy: boolean }) {
      const toasts = useToasts(privacy);
      return createElement("div", null,
        createElement("button", {
          onClick: () => toasts.push({
            message: "Secret Project → Trash",
            privacyMessage: "Hidden bookmark → Trash",
            actionLabel: "Undo",
            onAction: vi.fn(),
          }),
        }, "Show"),
        toasts.region,
      );
    }

    const { rerender } = render(createElement(I18nProvider, { preference: "en", children: createElement(PrivacyToastHarness, { privacy: false }) }));
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Secret Project → Trash")).toBeVisible();

    // Enable privacy mode after the toast was already pushed
    rerender(createElement(I18nProvider, { preference: "en", children: createElement(PrivacyToastHarness, { privacy: true }) }));
    expect(screen.queryByText("Secret Project → Trash")).toBeNull();
    expect(screen.getByText("Hidden bookmark → Trash")).toBeVisible();

    // Disable privacy mode again
    rerender(createElement(I18nProvider, { preference: "en", children: createElement(PrivacyToastHarness, { privacy: false }) }));
    expect(screen.getByText("Secret Project → Trash")).toBeVisible();
    expect(screen.queryByText("Hidden bookmark → Trash")).toBeNull();
  });

  it("dismisses an open SelectField on Escape without closing the containing Modal", async () => {
    const onModalClose = vi.fn();
    const options = [
      { value: "opt-1", label: "Option 1" },
      { value: "opt-2", label: "Option 2" },
    ];
    function ModalWithSelect() {
      const [val, setVal] = useState("opt-1");
      return createElement(Modal, {
        open: true,
        title: "Edit Item",
        onClose: onModalClose,
        children: createElement(SelectField, { value: val, options, onChange: setVal, label: "Choose option" }),
      });
    }
    render(createElement(I18nProvider, { preference: "en", children: createElement(ModalWithSelect) }));

    const trigger = screen.getByRole("combobox", { name: "Choose option" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    // Pressing Escape while select is open must close only the select listbox
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onModalClose).not.toHaveBeenCalled();

    // Pressing Escape again while select is closed closes the modal
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onModalClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses an open FloatingContextMenu on Escape without closing the containing Modal", () => {
    const onModalClose = vi.fn();
    const onMenuClose = vi.fn();
    function ModalWithContextMenu({ menuOpen }: { menuOpen: boolean }) {
      return createElement(Modal, {
        open: true,
        title: "Modal Title",
        onClose: onModalClose,
        children: createElement("div", null,
          createElement("p", null, "Content"),
          menuOpen ? createElement(FloatingContextMenu, {
            label: "Item Actions",
            point: { x: 50, y: 50 },
            onClose: onMenuClose,
            children: createElement("button", null, "Action 1"),
          }) : null,
        ),
      });
    }
    const { rerender } = render(createElement(I18nProvider, { preference: "en", children: createElement(ModalWithContextMenu, { menuOpen: true }) }));
    expect(screen.getByRole("menu", { name: "Item Actions" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onMenuClose).toHaveBeenCalled();
    expect(onModalClose).not.toHaveBeenCalled();

    rerender(createElement(I18nProvider, { preference: "en", children: createElement(ModalWithContextMenu, { menuOpen: false }) }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onModalClose).toHaveBeenCalledTimes(1);
  });
});
