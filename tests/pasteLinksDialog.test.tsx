import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceData } from "../src/domain/models";
import { I18nProvider } from "../src/i18n";
import { db } from "../src/db/database";
import * as repository from "../src/db/repository";
import { PasteLinksDialog } from "../src/features/bookmarks/PasteLinksDialog";

let workspace: WorkspaceData;
let boardId: string;
let otherBoardId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  const initial = await repository.ensureStarterWorkspace();
  boardId = initial.boards[0]!.id;
  otherBoardId = (await repository.createBoard(initial.pages[0]!.id, "Reading")).id;
  await repository.createBookmark({ boardId, title: "Existing", url: "https://example.com" });
  workspace = await repository.getWorkspaceData();
});
afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });
function mount(initialText = "", privacy = false, onCreated = vi.fn()) {
  function Host() {
    const [open, setOpen] = useState(true);
    return <I18nProvider preference="en">{open ? <PasteLinksDialog workspace={workspace} boardId={boardId} initialText={initialText} privacy={privacy} onClose={() => setOpen(false)} onCreated={onCreated} /> : null}</I18nProvider>;
  }
  return render(<Host />);
}

describe("Paste Links dialog", () => {
  it("updates new, duplicate and invalid counters while editing and changing destination", () => {
    mount("https://github.com\nhttps://github.com/#hash\nhttps://example.com\ninvalid\nfile:///secret");
    expect(screen.getByText("1 new · 2 duplicate · 2 invalid")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveTextContent("Workspace › Inbox");
    fireEvent.change(screen.getByRole("combobox", { name: "Destination" }), { target: { value: otherBoardId } });
    expect(screen.getByText("2 new · 1 duplicate · 2 invalid")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Links" }), { target: { value: "https://github.com" } });
    expect(screen.getByText("1 new · 0 duplicate · 0 invalid")).toBeInTheDocument();
  });
  it("disables Add at zero new links, focuses and bounds the labelled textarea", () => {
    mount("https://example.com\nnot a link");
    expect(screen.getByRole("button", { name: "Add 0 bookmarks" })).toBeDisabled();
    const text = screen.getByRole("textbox", { name: "Links" });
    expect(text).toHaveFocus();
    expect(text).toHaveAttribute("maxlength", "100000");
    fireEvent.change(text, { target: { value: "" } });
    expect(screen.getByText("0 new · 0 duplicate · 0 invalid")).toBeInTheDocument();
  });
  it("saves only unique new URLs through bulk create into the selected destination and closes", async () => {
    const bulk = vi.spyOn(repository, "createBookmarksBulk");
    const onCreated = vi.fn();
    mount("https://github.com\nhttps://example.com", false, onCreated);
    fireEvent.change(screen.getByRole("combobox", { name: "Destination" }), { target: { value: otherBoardId } });
    fireEvent.click(screen.getByRole("button", { name: "Add 2 bookmarks" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bulk).toHaveBeenCalledExactlyOnceWith(otherBoardId, [{ url: "https://github.com/", title: "GitHub" }, { url: "https://example.com/", title: "Example" }]);
    const added = (await repository.getWorkspaceData()).bookmarks.filter((item) => item.boardId === otherBoardId);
    expect(added.map((item) => item.title)).toEqual(["GitHub", "Example"]);
    expect(onCreated).toHaveBeenCalledWith(added, expect.objectContaining({ id: otherBoardId }));
  });
  it("closes on Escape or Cancel without saving", () => {
    const view = mount("https://github.com");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    mount("https://github.com");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("shows a localized error on failure and allows retry", async () => {
    vi.spyOn(repository, "createBookmarksBulk").mockRejectedValueOnce(new Error("Private storage error"));
    mount("https://github.com");
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bookmarks" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add links");
    expect(screen.getByRole("button", { name: "Add 1 bookmarks" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bookmarks" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await repository.getWorkspaceData()).bookmarks.map((item) => item.title)).toEqual(["Existing", "GitHub"]);
  });
  it("hides destination names in Privacy Mode", () => {
    mount("https://github.com", true);
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveTextContent("Page › Board");
    expect(screen.getByRole("dialog")).not.toHaveTextContent(/Workspace|Inbox|Reading/u);
  });
  it("disables save when the destination disappears", () => {
    workspace = { ...workspace, boards: [] };
    mount("https://github.com");
    expect(screen.getByRole("button", { name: "Add 1 bookmarks" })).toBeDisabled();
  });
  it("does not close a replacement dialog when a dismissed save completes", async () => {
    let finish: (() => void) | undefined;
    vi.spyOn(repository, "createBookmarksBulk").mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve([]); }));
    function Host() {
      const [dialogId, setDialogId] = useState(1);
      return <I18nProvider preference="en">
        <button onClick={() => setDialogId(2)}>Reopen paste</button>
        {dialogId > 0 ? <PasteLinksDialog key={dialogId} workspace={workspace} boardId={boardId} initialText="https://github.com" privacy={false} onClose={() => setDialogId(0)} onCreated={vi.fn()} /> : null}
      </I18nProvider>;
    }
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bookmarks" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Reopen paste" }));
    await act(async () => { finish?.(); await Promise.resolve(); });
    expect(screen.getByRole("dialog", { name: "Paste links" })).toBeInTheDocument();
  });
  it("keeps Add disabled throughout a pending transaction", async () => {
    let finish: (() => void) | undefined;
    vi.spyOn(repository, "createBookmarksBulk").mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve([]); }));
    mount("https://github.com");
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bookmarks" }));
    expect(screen.getByRole("button", { name: "Add 1 bookmarks" })).toBeDisabled();
    await act(async () => { finish?.(); await Promise.resolve(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
