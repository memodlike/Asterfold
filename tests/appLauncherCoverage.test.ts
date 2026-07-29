import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppLauncher } from "../src/app/AppLauncher";
import type { Page } from "../src/domain/models";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const pages: Page[] = [
  { id: "p1", userId: null, title: "Primary", icon: null, accent: null, position: "a", isDefault: true, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "p2", userId: null, title: "Secondary", icon: null, accent: null, position: "b", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
  { id: "p3", userId: null, title: "Tertiary", icon: null, accent: null, position: "c", isDefault: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 },
];

function callbacks() {
  return {
    onCreateBoard: vi.fn(),
    onCreatePage: vi.fn(),
    onSelectPage: vi.fn(),
    onRenamePage: vi.fn(),
    onDuplicatePage: vi.fn(),
    onDefaultPage: vi.fn(),
    onMovePage: vi.fn(),
    onDeletePage: vi.fn(),
    onSearch: vi.fn(),
    onPrivacy: vi.fn(),
    onTrash: vi.fn(),
    onSettings: vi.fn(),
    onDismissFirstRunHint: vi.fn(),
  };
}

function renderLauncher(overrides: Partial<Parameters<typeof AppLauncher>[0]> = {}) {
  const handlers = callbacks();
  const props: Parameters<typeof AppLauncher>[0] = {
    pages,
    activePageId: "p2",
    privacy: false,
    ...handlers,
    ...overrides,
  };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(AppLauncher, props) }));
  return { ...view, handlers, props };
}

function openMenu(): void {
  fireEvent.click(screen.getByRole("button", { name: "Open Asterfold menu" }));
}

function openPages(): void {
  const launcherTrigger = screen.getByRole("button", { name: "Open Asterfold menu" });
  if (launcherTrigger.getAttribute("aria-expanded") !== "true") fireEvent.click(launcherTrigger);
  const pagesTrigger = screen.getByRole("menuitem", { name: "Pages" });
  if (pagesTrigger.getAttribute("aria-expanded") !== "true") fireEvent.click(pagesTrigger);
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({ x: 10, y: 20, top: 20, right: 120, bottom: 60, left: 10, width: 110, height: 40, toJSON: () => ({}) })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AppLauncher complete interaction coverage", () => {
  it("routes every primary launcher command and closes after actions", () => {
    const { handlers } = renderLauncher();
    for (const [name, callback] of [
      ["New board", handlers.onCreateBoard],
      ["Search", handlers.onSearch],
      ["Turn privacy on", handlers.onPrivacy],
      ["Trash", handlers.onTrash],
      ["Settings", handlers.onSettings],
    ] as const) {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name }));
      expect(callback).toHaveBeenCalledOnce();
      expect(screen.queryByRole("menu")).toBeNull();
    }
  });

  it("creates and selects pages and marks the active page", () => {
    const { handlers } = renderLauncher();
    openMenu();
    openPages();
    expect(screen.getByRole("menuitem", { name: "Secondary" })).toHaveClass("is-active");
    fireEvent.click(screen.getByRole("menuitem", { name: "Create page" }));
    expect(handlers.onCreatePage).toHaveBeenCalledOnce();

    openMenu();
    openPages();
    fireEvent.click(screen.getByRole("menuitem", { name: "Tertiary" }));
    expect(handlers.onSelectPage).toHaveBeenCalledWith("p3");
  });

  it("supports arrow, Home and End navigation in the open menu", () => {
    renderLauncher();
    openMenu();
    const first = screen.getByRole("menuitem", { name: "New board" });
    const last = screen.getByRole("menuitem", { name: "Settings" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    expect(last).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Home" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(last).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(first).toHaveFocus();
  });

  it("opens page actions by pointer and keyboard and routes every enabled action", () => {
    const { handlers } = renderLauncher();
    const actOnSecondary = (name: string): void => {
      openPages();
      const secondary = screen.getByRole("menuitem", { name: "Secondary" });
      fireEvent.contextMenu(secondary, { clientX: 50, clientY: 80 });
      fireEvent.click(screen.getByRole("menuitem", { name }));
    };

    actOnSecondary("Rename");
    expect(handlers.onRenamePage).toHaveBeenCalledWith(pages[1]);
    actOnSecondary("Duplicate");
    expect(handlers.onDuplicatePage).toHaveBeenCalledWith(pages[1]);
    actOnSecondary("Default page");
    expect(handlers.onDefaultPage).toHaveBeenCalledWith(pages[1]);
    actOnSecondary("Move left");
    expect(handlers.onMovePage).toHaveBeenCalledWith(pages[1], 0);
    actOnSecondary("Move right");
    expect(handlers.onMovePage).toHaveBeenCalledWith(pages[1], 2);
    actOnSecondary("Move to trash");
    expect(handlers.onDeletePage).toHaveBeenCalledWith(pages[1]);

    openPages();
    const tertiary = screen.getByRole("menuitem", { name: "Tertiary" });
    fireEvent.keyDown(tertiary, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu", { name: "Page" })).toBeVisible();
  });

  it("disables page actions at boundaries and on the default page", () => {
    renderLauncher();
    openMenu();
    openPages();
    fireEvent.contextMenu(screen.getByRole("menuitem", { name: "Primary" }));
    expect(screen.getByRole("menuitem", { name: "Default page" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Move left" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });

    openMenu();
    openPages();
    fireEvent.contextMenu(screen.getByRole("menuitem", { name: "Tertiary" }));
    expect(screen.getByRole("menuitem", { name: "Move right" })).toBeDisabled();
  });

  it("closes on Escape, outside pointer and delayed pointer leave while restoring focus", () => {
    renderLauncher();
    const trigger = screen.getByRole("button", { name: "Open Asterfold menu" });
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();

    openMenu();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    openMenu();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    fireEvent.pointerLeave(trigger.closest(".app-launcher")!);
    act(() => { vi.advanceTimersByTime(351); });
    outside.remove();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps the menu open while focus remains inside during delayed close", () => {
    renderLauncher();
    openMenu();
    const menu = screen.getByRole("menu");
    screen.getByRole("menuitem", { name: "New board" }).focus();
    fireEvent.pointerLeave(menu.closest(".app-launcher")!);
    act(() => { vi.advanceTimersByTime(351); });
    expect(menu).toBeVisible();
    fireEvent.pointerEnter(menu.closest(".app-launcher")!);
  });

  it("dismisses first-use guidance through both discovery controls", () => {
    const { handlers } = renderLauncher({ showFirstRunHint: true });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    expect(handlers.onDismissFirstRunHint).toHaveBeenCalledOnce();

    cleanup();
    const second = renderLauncher({ showFirstRunHint: true });
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(second.handlers.onDismissFirstRunHint).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu")).toBeVisible();
  });
});
