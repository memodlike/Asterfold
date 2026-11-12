import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuideTour } from "../src/features/onboarding/GuideTour";
import { completeTour, readTourPending, requestTour, TOUR_EVENT } from "../src/features/onboarding/tourState";
import { I18nProvider } from "../src/i18n";

function mountWorkspace(withBoard = true): void {
  const shell = document.createElement("div");
  shell.id = "tour-fixture";
  shell.innerHTML = "";
  if (withBoard) {
    const track = document.createElement("div");
    track.className = "board-track";
    const board = document.createElement("section");
    board.className = "board";
    const header = document.createElement("header");
    header.className = "board__header";
    board.append(header);
    track.append(board);
    shell.append(track);
  }
  const trigger = document.createElement("button");
  trigger.className = "launcher-trigger";
  shell.append(trigger);
  document.body.append(shell);
}

function renderTour(onFinish = vi.fn(), onOpenImport = vi.fn()) {
  render(<I18nProvider preference="en"><GuideTour onFinish={onFinish} onOpenImport={onOpenImport} /></I18nProvider>);
  return { onFinish, onOpenImport };
}

describe("first-run tips", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.getElementById("tour-fixture")?.remove();
    localStorage.clear();
  });

  it("is requested once after the welcome screen and stays finished", () => {
    const heard = vi.fn();
    window.addEventListener(TOUR_EVENT, heard);
    expect(readTourPending(), "existing users are never interrupted").toBe(false);
    requestTour();
    expect(readTourPending()).toBe(true);
    completeTour();
    expect(readTourPending()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(TOUR_EVENT, heard);
  });

  it("walks through four tips that point at real controls", () => {
    mountWorkspace();
    const { onFinish } = renderTour();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Boards keep your bookmarks");
    expect(screen.getByRole("img", { name: "1 of 4" })).toBeVisible();
    expect(document.documentElement.dataset.tourStep).toBe("boards");
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Add a link in a second");
    expect(screen.getByRole("dialog")).toHaveTextContent(/paste it here with (?:Ctrl \+ V|⌘ V)/u);
    expect(document.documentElement.dataset.tourStep).toBe("add");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Boards keep your bookmarks");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Everything else is in this menu");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Bring your Chrome bookmarks");
    expect(screen.queryByRole("button", { name: "Skip tips" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("can jump straight to the Chrome import steps from the last tip", () => {
    mountWorkspace(false);
    const { onFinish, onOpenImport } = renderTour();
    // Without boards only the two launcher tips remain.
    expect(screen.getByRole("img", { name: "1 of 2" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Show me how" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onOpenImport).toHaveBeenCalledTimes(1);
  });

  it("ends on Skip or Escape, keeps Tab inside the card and cleans up after itself", () => {
    mountWorkspace();
    const { onFinish } = renderTour();
    fireEvent.click(screen.getByRole("button", { name: "Skip tips" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFinish).toHaveBeenCalledTimes(2);

    const next = screen.getByRole("button", { name: "Next" });
    const skip = screen.getByRole("button", { name: "Skip tips" });
    next.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();
    document.querySelector<HTMLButtonElement>(".launcher-trigger")!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(skip).toHaveFocus();
  });

  it("finishes at once when there is nothing to point at", () => {
    const { onFinish } = renderTour();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
