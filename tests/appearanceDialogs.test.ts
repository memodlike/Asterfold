import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { Board, Page } from "../src/domain/models";
import { Logo } from "../src/components/Logo";
import { MoveDialog } from "../src/components/MoveDialog";
import { NameDialog } from "../src/components/NameDialog";
import { BUILTIN_WALLPAPERS, isDarkTheme, themeStyle } from "../src/features/appearance/themeRuntime";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const page: Page = { id: "page", userId: null, title: "Work", icon: null, accent: null, position: "0001", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const pageTwo: Page = { ...page, id: "page-two", title: "Personal", isDefault: false };
const board: Board = { id: "board", userId: null, pageId: page.id, title: "Inbox", icon: null, accent: null, position: "0001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const boardTwo: Board = { ...board, id: "board-two", pageId: pageTwo.id, title: "Later" };

function withI18n(node: ReturnType<typeof createElement>) {
  return createElement(I18nProvider, { preference: "en", children: node });
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
});
afterEach(() => cleanup());

describe("appearance runtime", () => {
  it("builds light, dark, solid, builtin, custom and density styles", () => {
    const base = createDefaultSettings().theme;
    const light = themeStyle({ ...base, backgroundMode: "solid", canvas: "#abcdef", density: "compact" }, null, false) as Record<string, string | number>;
    expect(light["--color-canvas"]).toBe("#abcdef");
    expect(light["--density-space"]).toBe("8px");
    expect(light["--wallpaper-image"]).toBe("none");
    expect(light["--wallpaper-dim"]).toBe(0);

    const builtin = themeStyle({ ...base, backgroundMode: "wallpaper", wallpaperId: BUILTIN_WALLPAPERS[0].id, wallpaperBlur: 6, wallpaperSaturation: 0.8, wallpaperZoom: 1.2, density: "spacious" }, null, true) as Record<string, string | number>;
    expect(builtin["--wallpaper-image"]).toContain("quiet-aurora.webp");
    expect(builtin["--wallpaper-filter"]).toBe("blur(6px) saturate(0.8)");
    expect(builtin["--wallpaper-transform"]).toBe("scale(1.2)");
    expect(builtin["--density-space"]).toBe("16px");
    expect(builtin["--glass-highlight"]).toContain(".14");

    const custom = themeStyle(
      { ...base, backgroundMode: "wallpaper", wallpaperId: "custom", wallpaperBlur: 0, wallpaperSaturation: 1, wallpaperZoom: 1, glassVariant: "clear" },
      "blob:wallpaper",
      "blob:compatibility",
      false,
      "compatibility",
    ) as Record<string, string | number>;
    expect(custom["--wallpaper-image"]).toBe('url("blob:wallpaper")');
    expect(custom["--wallpaper-compat-image"]).toBe('url("blob:wallpaper")');
    expect(custom["--wallpaper-software-image"]).toBe('url("blob:compatibility")');
    expect(custom["--wallpaper-filter"]).toBe("none");
    expect(custom["--wallpaper-transform"]).toBe("none");
    expect(custom["--glass-sheen"]).toBe(".09");
    expect(custom["--glass-blur"]).toBe(`${Math.min(32, base.blur)}px`);
  });

  it("resolves explicit and system dark modes", () => {
    const base = createDefaultSettings().theme;
    expect(isDarkTheme({ ...base, mode: "dark" })).toBe(true);
    expect(isDarkTheme({ ...base, mode: "light" })).toBe(false);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    expect(isDarkTheme({ ...base, mode: "system" })).toBe(true);
  });

  it("renders full and compact accessible logos", () => {
    const full = render(createElement(Logo));
    expect(screen.getByRole("img", { name: "Asterfold" })).toBeVisible();
    expect(screen.getByText("Asterfold")).toBeVisible();
    full.unmount();
    render(createElement(Logo, { compact: true }));
    expect(screen.getByRole("img", { name: "Asterfold" })).toBeVisible();
    expect(screen.queryByText("Asterfold")).toBeNull();
  });
});

describe("NameDialog", () => {
  it("trims and submits a valid name then closes", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    render(withI18n(createElement(NameDialog, { open: true, title: "Rename", label: "Name", initialValue: " Old ", onClose: close, onSubmit: submit })));
    const input = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "  New name  " } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(submit).toHaveBeenCalledWith("New name"));
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open and shows an error when submission fails", async () => {
    const close = vi.fn();
    render(withI18n(createElement(NameDialog, { open: true, title: "Create", label: "Name", initialValue: "Item", onClose: close, onSubmit: vi.fn().mockRejectedValue(new Error("failed")) })));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(close).not.toHaveBeenCalled();
  });

  it("resets values when reopened and disables empty submission", () => {
    const view = render(withI18n(createElement(NameDialog, { open: true, title: "Create", label: "Name", initialValue: "", onClose: vi.fn(), onSubmit: vi.fn() })));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    view.rerender(withI18n(createElement(NameDialog, { open: true, title: "Create", label: "Name", initialValue: "Ready", onClose: vi.fn(), onSubmit: vi.fn() })));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Ready");
  });
});

describe("MoveDialog", () => {
  it("moves a board to another page and closes", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    render(withI18n(createElement(MoveDialog, { open: true, type: "board", pages: [page, pageTwo], boards: [board, boardTwo], currentId: page.id, onClose: close, onMove: move })));
    expect(screen.getByRole("combobox")).toHaveValue(pageTwo.id);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(move).toHaveBeenCalledWith(pageTwo.id));
    expect(close).toHaveBeenCalledOnce();
  });

  it("moves bookmarks between boards and reports failures", async () => {
    const move = vi.fn().mockRejectedValue(new Error("failed"));
    const close = vi.fn();
    render(withI18n(createElement(MoveDialog, { open: true, type: "bookmark", pages: [page, pageTwo], boards: [board, boardTwo], currentId: board.id, onClose: close, onMove: move })));
    expect(screen.getByRole("combobox")).toHaveValue(boardTwo.id);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(close).not.toHaveBeenCalled();
  });

  it("disables movement when no destination exists and supports cancel", () => {
    const close = vi.fn();
    render(withI18n(createElement(MoveDialog, { open: true, type: "bulk-bookmarks", pages: [page], boards: [board], currentId: board.id, onClose: close, onMove: vi.fn() })));
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("resets destination and error when reopened", async () => {
    const props = { open: true, type: "bookmark" as const, pages: [page, pageTwo], boards: [board, boardTwo], currentId: undefined, onClose: vi.fn(), onMove: vi.fn().mockRejectedValue(new Error("failed")) };
    const view = render(withI18n(createElement(MoveDialog, props)));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: boardTwo.id } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    view.rerender(withI18n(createElement(MoveDialog, { ...props, open: false })));
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(withI18n(createElement(MoveDialog, { ...props, open: true })));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("combobox")).toHaveValue(board.id);
  });
});
