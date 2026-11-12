import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("wxt/browser", () => ({ browser: { tabs: { create: mocks.create }, runtime: { sendMessage: vi.fn() } } }));

import { ChromeImportGuide } from "../src/features/onboarding/ChromeImportGuide";
import { translate, type MessageKey } from "../src/i18n";

const t = (key: MessageKey, params?: Record<string, string | number>): string => translate("en", key, params);
const file = new File(["<DL><p></DL>"], "bookmarks.html", { type: "text/html" });

function dataTransfer(types: string[], files: File[] = []): { types: string[]; files: File[] } {
  return { types, files };
}

describe("Chrome import guide", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.create.mockResolvedValue({});
  });

  it("explains the three steps and that no permission is involved", () => {
    render(<ChromeImportGuide t={t} onFile={vi.fn()} />);
    const guide = screen.getByRole("group", { name: "Move bookmarks from Chrome" });
    expect(guide.querySelectorAll("ol > li")).toHaveLength(3);
    expect(guide).toHaveTextContent("Open Chrome's Bookmark manager.");
    expect(guide).toHaveTextContent("Export bookmarks");
    expect(guide).toHaveTextContent("No permission needed. Icons saved in the file are imported too.");
  });

  it("opens Chrome's own bookmark manager and falls back to the shortcut when Chrome refuses", async () => {
    render(<ChromeImportGuide t={t} onFile={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    expect(mocks.create).toHaveBeenCalledWith({ url: "chrome://bookmarks/" });
    expect(screen.queryByRole("status")).toBeNull();

    mocks.create.mockRejectedValueOnce(new Error("blocked"));
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Press (?:Ctrl \+ Shift \+ O|⌥ ⌘ B) in Chrome/u));
  });

  it("takes the exported file from the button or from a drop, and ignores dragged text", () => {
    const onFile = vi.fn();
    const { container } = render(<ChromeImportGuide t={t} onFile={onFile} layout="row" />);
    const guide = screen.getByRole("group", { name: "Move bookmarks from Chrome" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input).toHaveAttribute("accept", ".html,.htm,text/html");
    const picker = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Choose file" }));
    expect(picker).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenLastCalledWith(file);

    fireEvent.dragOver(guide, { dataTransfer: dataTransfer(["text/plain"]) });
    expect(guide).not.toHaveClass("is-dragging");
    fireEvent.drop(guide, { dataTransfer: dataTransfer(["text/plain"]) });
    expect(onFile).toHaveBeenCalledTimes(1);

    fireEvent.dragOver(guide, { dataTransfer: dataTransfer(["Files"]) });
    expect(guide).toHaveClass("is-dragging");
    fireEvent.dragLeave(guide, { relatedTarget: document.body });
    expect(guide).not.toHaveClass("is-dragging");
    fireEvent.dragOver(guide, { dataTransfer: dataTransfer(["Files"]) });
    fireEvent.drop(guide, { dataTransfer: dataTransfer(["Files"], [file]) });
    expect(guide).not.toHaveClass("is-dragging");
    expect(onFile).toHaveBeenCalledTimes(2);
  });

  it("does not start a second import while one is running", () => {
    const onFile = vi.fn();
    render(<ChromeImportGuide t={t} onFile={onFile} busy />);
    expect(screen.getByRole("button", { name: "Choose file" })).toBeDisabled();
    fireEvent.drop(screen.getByRole("group", { name: "Move bookmarks from Chrome" }), { dataTransfer: dataTransfer(["Files"], [file]) });
    expect(onFile).not.toHaveBeenCalled();
  });
});
