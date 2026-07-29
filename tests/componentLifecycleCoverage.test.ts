import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingContextMenu } from "../src/components/FloatingContextMenu";
import { Modal } from "../src/components/Modal";
import { useToasts } from "../src/components/ToastRegion";
import { I18nProvider } from "../src/i18n";

function ToastHarness({ expose }: { expose: (controller: ReturnType<typeof useToasts>) => void }) {
  const controller = useToasts();
  expose(controller);
  return controller.region;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({ x: 0, y: 0, top: 0, right: 180, bottom: 120, left: 0, width: 180, height: 120, toJSON: () => ({}) })),
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Modal lifecycle coverage", () => {
  it("renders semantic metadata, side/fullscreen classes and footer", () => {
    const close = vi.fn();
    const view = render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(Modal, {
        open: false,
        title: "Hidden",
        onClose: close,
        children: createElement("p", null, "Hidden body"),
      }),
    }));
    expect(screen.queryByRole("dialog")).toBeNull();

    view.rerender(createElement(I18nProvider, {
      preference: "en",
      children: createElement(Modal, {
        open: true,
        title: "Visible",
        description: "Description",
        size: "fullscreen",
        side: true,
        className: "custom-modal",
        onClose: close,
        footer: createElement("button", null, "Footer action"),
        children: createElement("p", null, "Body"),
      }),
    }));
    const dialog = screen.getByRole("dialog", { name: "Visible" });
    expect(dialog).toHaveAttribute("aria-describedby");
    expect(dialog).toHaveClass("modal--fullscreen", "modal--side", "custom-modal");
    expect(dialog.closest(".modal-backdrop")).toHaveClass("modal-backdrop--side");
    expect(screen.getByRole("button", { name: "Footer action" })).toBeVisible();
  });

  it("cycles focus, handles Escape and restores the previously focused element", () => {
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(outside);
    outside.focus();
    const close = vi.fn();
    const view = render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(Modal, {
        open: true,
        title: "Keyboard",
        onClose: close,
        children: createElement("div", null,
          createElement("button", null, "First"),
          createElement("input", { "aria-label": "Middle" }),
          createElement("button", null, "Last"),
        ),
      }),
    }));
    const first = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it("focuses the panel when every descendant is disabled", () => {
    render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(Modal, {
        open: true,
        title: "Disabled",
        onClose: vi.fn(),
        children: createElement("button", { disabled: true }, "Disabled action"),
      }),
    }));
    const dialog = screen.getByRole("dialog");
    const closeButton = screen.getByRole("button", { name: "Close" });
    Object.defineProperty(closeButton, "offsetParent", { configurable: true, value: null });
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog).toHaveFocus();
  });

  it("closes only for a complete backdrop click and always supports the close control", () => {
    const close = vi.fn();
    render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(Modal, { open: true, title: "Backdrop", onClose: close, children: createElement("p", null, "Body") }),
    }));
    const backdrop = screen.getByRole("presentation");
    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(dialog);
    expect(close).not.toHaveBeenCalled();
    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop);
    expect(close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("FloatingContextMenu lifecycle coverage", () => {
  function menu(onClose = vi.fn(), point = { x: 300, y: 230 }) {
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.append(trigger);
    trigger.focus();
    const view = render(createElement(FloatingContextMenu, {
      label: "Actions",
      point,
      onClose,
      children: createElement("div", null,
        createElement("button", null, "Alpha"),
        createElement("button", { disabled: true }, "Disabled"),
        createElement("button", null, "Beta"),
        createElement("button", null, "Bravo"),
      ),
    }));
    return { ...view, onClose, trigger };
  }

  it("constrains placement and assigns menuitem roles", async () => {
    const { rerender, onClose } = menu();
    const context = screen.getByRole("menu", { name: "Actions" });
    Object.defineProperty(context, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({ x: 0, y: 0, top: 0, right: 180, bottom: 120, left: 0, width: 180, height: 120, toJSON: () => ({}) })),
    });
    rerender(createElement(FloatingContextMenu, {
      label: "Actions",
      point: { x: 301, y: 231 },
      onClose,
      children: createElement("div", null,
        createElement("button", null, "Alpha"),
        createElement("button", { disabled: true }, "Disabled"),
        createElement("button", null, "Beta"),
        createElement("button", null, "Bravo"),
      ),
    }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("menu", { name: "Actions" })).toHaveStyle({ left: "132px", top: "112px" });
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Disabled" })).toBeDisabled();
  });

  it("supports arrows, Home, End, typeahead, Escape and focus restoration", async () => {
    const { onClose, trigger } = menu();
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Bravo" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "End" });
    expect(screen.getByRole("menuitem", { name: "Bravo" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Home" });
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "b" });
    expect(screen.getByRole("menuitem", { name: "Beta" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "r" });
    expect(screen.getByRole("menuitem", { name: "Bravo" })).toHaveFocus();
    act(() => { vi.advanceTimersByTime(501); });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => { await Promise.resolve(); });
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("closes for Tab, outside pointer, resize and capture-phase scroll", () => {
    for (const closeEvent of ["tab", "pointer", "resize", "scroll"] as const) {
      cleanup();
      const { onClose, trigger } = menu();
      if (closeEvent === "tab") fireEvent.keyDown(document, { key: "Tab" });
      if (closeEvent === "pointer") fireEvent.pointerDown(document.body);
      if (closeEvent === "resize") fireEvent(window, new Event("resize"));
      if (closeEvent === "scroll") fireEvent(window, new Event("scroll"));
      expect(onClose).toHaveBeenCalledOnce();
      trigger.remove();
    }
  });

  it("does not close for pointer activity inside the menu and reacts to a new point", () => {
    const { rerender, onClose, trigger } = menu();
    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(onClose).not.toHaveBeenCalled();
    rerender(createElement(FloatingContextMenu, {
      label: "Actions",
      point: { x: 20, y: 30 },
      onClose,
      children: createElement("button", null, "Alpha"),
    }));
    expect(screen.getByRole("menu")).toHaveStyle({ left: "20px", top: "30px" });
    trigger.remove();
  });
});

describe("ToastRegion lifecycle coverage", () => {
  function harness() {
    let controller: ReturnType<typeof useToasts> | undefined;
    const view = render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(ToastHarness, { expose: (value) => { controller = value; } }),
    }));
    return { ...view, controller: () => controller! };
  }

  it("limits the stack to three toasts and expires neutral and actionable messages", () => {
    const { controller } = harness();
    act(() => {
      controller().push({ message: "One" });
      controller().push({ message: "Two", tone: "success" });
      controller().push({ message: "Three", tone: "error" });
      controller().push({ message: "Four", actionLabel: "Undo", onAction: vi.fn() });
    });
    expect(screen.queryByText("One")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Three");
    expect(screen.getAllByRole("button", { name: "Dismiss notification" })).toHaveLength(3);
    act(() => { vi.advanceTimersByTime(4_001); });
    expect(screen.queryByText("Two")).toBeNull();
    expect(screen.getByText("Four")).toBeVisible();
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.queryByText("Four")).toBeNull();
  });

  it("dismisses a toast and pauses/resumes expiry for pointer and focus", () => {
    const { controller } = harness();
    act(() => { controller().push({ message: "Paused", actionLabel: "Undo", onAction: vi.fn() }); });
    const toast = screen.getByText("Paused").closest(".toast")!;
    fireEvent.pointerEnter(toast);
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText("Paused")).toBeVisible();
    fireEvent.pointerLeave(toast);
    act(() => { vi.advanceTimersByTime(2_001); });
    expect(screen.queryByText("Paused")).toBeNull();

    act(() => { controller().push({ message: "Focused", actionLabel: "Undo", onAction: vi.fn() }); });
    const focusedToast = screen.getByText("Focused").closest(".toast")!;
    const undo = screen.getByRole("button", { name: "Undo" });
    undo.focus();
    fireEvent.pointerLeave(focusedToast);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByText("Focused")).toBeVisible();
    fireEvent.blur(undo, { relatedTarget: document.body });
    act(() => { vi.advanceTimersByTime(2_001); });
    expect(screen.queryByText("Focused")).toBeNull();

    act(() => { controller().push({ message: "Dismiss me" }); });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Dismiss me")).toBeNull();
  });

  it("runs an action once, disables it while pending and removes on success", async () => {
    let finish: (() => void) | undefined;
    const action = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { controller } = harness();
    act(() => { controller().push({ message: "Undoable", actionLabel: "Undo", onAction: action }); });
    const button = screen.getByRole("button", { name: "Undo" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    expect(screen.queryByText("Undoable")).toBeNull();
  });

  it("converts a failed action into an error toast and expires it", async () => {
    const { controller } = harness();
    act(() => { controller().push({ message: "Will fail", actionLabel: "Retry", onAction: vi.fn().mockRejectedValue(new Error("failure")) }); });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to complete the action");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    act(() => { vi.advanceTimersByTime(4_001); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears all pending timers when the toast host unmounts", () => {
    const clear = vi.spyOn(window, "clearTimeout");
    const { controller, unmount } = harness();
    act(() => {
      controller().push({ message: "One" });
      controller().push({ message: "Two" });
    });
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
