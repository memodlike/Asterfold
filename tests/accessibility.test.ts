import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FloatingContextMenu } from "../src/components/FloatingContextMenu";
import { Modal } from "../src/components/Modal";
import { useToasts } from "../src/components/ToastRegion";
import { I18nProvider } from "../src/i18n";

function RejectingToastHarness() {
  const toasts = useToasts();
  return createElement("div", null,
    createElement("button", { onClick: () => toasts.push({ message: "Deleted", actionLabel: "Undo", onAction: () => Promise.reject(new Error("rollback failed")) }) }, "Show"),
    toasts.region,
  );
}

describe("accessible overlays", () => {
  it("focuses and navigates enabled context-menu actions", () => {
    const close = vi.fn();
    render(createElement(FloatingContextMenu, {
      label: "Actions",
      point: { x: 10, y: 10 },
      onClose: close,
      children: [
        createElement("button", { disabled: true, key: "disabled" }, "Disabled"),
        createElement("button", { key: "first" }, "First"),
        createElement("button", { key: "second" }, "Second"),
      ],
    }));
    expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Second" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Home" });
    expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("locks page scrolling while a modal is open", () => {
    const view = render(createElement(Modal, { open: true, title: "Dialog", onClose: vi.fn(), children: createElement("p", null, "Body") }));
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("uses the latest close callback without restarting the modal lifecycle", () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const view = render(createElement(Modal, { open: true, title: "Dialog", onClose: firstClose, children: createElement("button", null, "Action") }));
    view.rerender(createElement(Modal, { open: true, title: "Dialog", onClose: secondClose, children: createElement("button", null, "Action") }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledOnce();
  });

  it("keeps failed toast actions visible and announces a localized error", async () => {
    render(createElement(I18nProvider, { preference: "en", children: createElement(RejectingToastHarness) }));
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to complete the action"));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});
