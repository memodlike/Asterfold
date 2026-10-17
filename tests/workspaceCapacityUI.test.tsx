import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/db/database";
import { createBookmark, createPage, ensureStarterWorkspace, getWorkspaceData } from "../src/db/repository";
import { I18nProvider } from "../src/i18n";
import { NameDialog } from "../src/components/NameDialog";
import { BookmarkEditor } from "../src/features/bookmarks/BookmarkEditor";
import { PasteLinksDialog } from "../src/features/bookmarks/PasteLinksDialog";
import { SettingsDialog } from "../src/features/settings/SettingsDialog";
import { OnboardingWizard } from "../src/features/onboarding/OnboardingWizard";
import { createBackup } from "../src/services/exportImport";

vi.mock("../src/domain/importLimits", () => ({
  IMPORT_LIMITS: { fileBytes: 128 * 1024 * 1024, depth: 100, nodes: 250_000, pages: 2, boards: 3, bookmarks: 2 },
}));
vi.mock("../src/services/importWorker", () => ({
  parseHtmlOffThread: () => Promise.resolve([{ title: "Imported", url: "https://new.example/", description: null, folderPath: [] }]),
  parseBackupOffThread: async () => createBackup(),
}));

const message = "Workspace limit reached. Empty Trash or permanently delete items before adding more pages, boards, or bookmarks.";

describe("localized workspace capacity feedback", () => {
  beforeEach(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await db.delete();
    await db.open();
    const initial = await ensureStarterWorkspace();
    await createPage("Second");
    await createBookmark({ boardId: initial.boards[0]!.id, title: "One", url: "https://one.example" });
    await createBookmark({ boardId: initial.boards[0]!.id, title: "Two", url: "https://two.example" });
  });
  afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });

  it("explains page creation capacity failures inside the name dialog", async () => {
    render(<I18nProvider preference="en"><NameDialog open title="New page" label="Name" initialValue="Third" onClose={vi.fn()} onSubmit={(title) => createPage(title).then(() => undefined)} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("explains bookmark capacity failures without closing the editor", async () => {
    const workspace = await getWorkspaceData();
    const onError = vi.fn();
    const onClose = vi.fn();
    render(<I18nProvider preference="en"><BookmarkEditor open bookmark={null} initialBoardId={workspace.boards[0]!.id} initialUrl="https://new.example/" pages={workspace.pages} boards={workspace.boards} onClose={onClose} onSaved={vi.fn()} onError={onError} /></I18nProvider>);
    fireEvent.submit(screen.getByRole("textbox", { name: "Title" }).closest("form")!);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(message));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("explains bulk paste capacity failures inline", async () => {
    const workspace = await getWorkspaceData();
    render(<I18nProvider preference="en"><PasteLinksDialog workspace={workspace} boardId={workspace.boards[0]!.id} initialText="https://new.example/" privacy={false} onClose={vi.fn()} onCreated={vi.fn()} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 bookmarks" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("explains onboarding capacity failures after restoring the prior workspace", async () => {
    const workspace = await getWorkspaceData();
    const onCompleted = vi.fn();
    const view = render(<I18nProvider preference="en"><OnboardingWizard workspace={workspace} onCompleted={onCompleted} /></I18nProvider>);
    fireEvent.click(screen.getByRole("radio", { name: /Import bookmark HTML/u }));
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"][accept*="text/html"]')!;
    const file = new File(["content"], "bookmarks.html");
    Object.defineProperty(file, "text", { value: () => Promise.resolve("content") });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText("bookmarks.html");
    fireEvent.click(screen.getByRole("button", { name: "Open my workspace" }));
    expect((await screen.findAllByText(message))[0]).toBeVisible();
    expect(onCompleted).not.toHaveBeenCalled();
    expect((await getWorkspaceData()).bookmarks).toEqual(workspace.bookmarks);
    expect((await getWorkspaceData()).settings.onboardingComplete).toBe(false);
  });

  it.each(["html", "json"])("explains %s import capacity failures in Settings", async (extension) => {
    const workspace = await getWorkspaceData();
    const onError = vi.fn();
    const view = render(<I18nProvider preference="en"><SettingsDialog open initialSection="data-privacy" workspace={workspace} onClose={vi.fn()} onUpdated={vi.fn()} onError={onError} onOpenTrash={vi.fn()} /></I18nProvider>);
    const input = view.container.querySelector<HTMLInputElement>('input[accept*=".json"]')!;
    const file = new File(["content"], `bookmarks.${extension}`);
    Object.defineProperty(file, "text", { value: () => Promise.resolve("content") });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: extension === "html" ? "Create" : "Merge" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(message));
    expect(await db.pages.count()).toBe(2);
  });
});
