import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceData } from "../src/domain/models";
import { db } from "../src/db/database";
import { createBoard, createBookmark, ensureStarterWorkspace, getWorkspaceData, updateSettings } from "../src/db/repository";

const state = vi.hoisted(() => ({ workspace: undefined as WorkspaceData | undefined, privacy: false }));
vi.mock("../src/app/useWorkspace", () => ({ useWorkspace: () => ({ workspace: state.workspace, failed: false, retry: vi.fn() }) }));
vi.mock("../src/app/usePrivacyMode", () => ({ usePrivacyMode: () => ({ privacy: state.privacy, setPrivacy: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock("../src/features/appearance/useThemeRuntime", () => ({ useThemeRuntime: () => "software" }));
import { WorkspaceApp } from "../src/app/WorkspaceApp";

function paste(text: string, target: EventTarget = window, types = ["text/plain"]): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { types, getData: (type: string) => type === "text/plain" ? text : "" } });
  act(() => { target.dispatchEvent(event); });
  return event;
}
async function mount() {
  state.workspace = await getWorkspaceData();
  return render(<WorkspaceApp />);
}
beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureStarterWorkspace();
  await updateSettings({ locale: "en", onboardingComplete: true });
  state.privacy = false;
  Object.defineProperty(performance, "mark", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  Object.defineProperty(globalThis, "CSS", { configurable: true, value: { escape: (value: string) => value, supports: () => false } });
});
afterEach(async () => { cleanup(); await db.delete(); vi.restoreAllMocks(); });

describe("workspace clipboard paste", () => {
  it.each(["input", "textarea", "select", "editable"])("ignores paste into %s", async (tag) => {
    await mount();
    const element = document.createElement(tag === "editable" ? "div" : tag);
    if (tag === "editable") element.setAttribute("contenteditable", "true");
    document.body.append(element);
    expect(paste("https://github.com", element).defaultPrevented).toBe(false);
    await act(async () => { await Promise.resolve(); });
    expect(await db.bookmarks.count()).toBe(0);
    element.remove();
  });
  it("ignores clipboard without plain text and oversized or unsafe text", async () => {
    await mount();
    expect(paste("https://github.com", window, ["text/html"]).defaultPrevented).toBe(false);
    expect(paste(`https://github.com ${"x".repeat(100001)}`).defaultPrevented).toBe(false);
    expect(paste("javascript:alert(1)").defaultPrevented).toBe(false);
    expect(await db.bookmarks.count()).toBe(0);
  });
  it("adds one URL with a local title and Undo removes exactly that bookmark", async () => {
    const initial = await getWorkspaceData();
    const existing = await createBookmark({ boardId: initial.boards[0]!.id, title: "Existing", url: "https://example.com" });
    await mount();
    expect(paste("https://github.com").defaultPrevented).toBe(true);
    expect(await screen.findByText("Added GitHub to Inbox")).toBeInTheDocument();
    expect((await getWorkspaceData()).bookmarks.map((item) => item.title)).toEqual(["Existing", "GitHub"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(async () => expect((await getWorkspaceData()).bookmarks.map((item) => item.id)).toEqual([existing.id]));
  });
  it("shows already-on-board for normalized duplicates", async () => {
    const initial = await getWorkspaceData();
    await createBookmark({ boardId: initial.boards[0]!.id, title: "GitHub", url: "https://github.com" });
    await mount();
    paste("https://GITHUB.com:443/?utm_source=copy#hash");
    expect(await screen.findByText("Already on this board")).toBeInTheDocument();
    expect(await db.bookmarks.count()).toBe(1);
  });
  it("opens a prefilled dialog for multiple URLs and ignores further workspace paste", async () => {
    await mount();
    const text = "https://github.com\nhttps://example.com";
    expect(paste(text).defaultPrevented).toBe(true);
    const dialog = await screen.findByRole("dialog", { name: "Paste links" });
    expect(within(dialog).getByRole("textbox")).toHaveValue(text);
    expect(paste("https://example.org").defaultPrevented).toBe(false);
    expect(await db.bookmarks.count()).toBe(0);
  });
  it("ignores paste while a name dialog or context menu is open", async () => {
    const view = await mount();
    fireEvent.contextMenu(view.container.querySelector("[data-board-id]")!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(paste("https://github.com").defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(paste("https://github.com").defaultPrevented).toBe(false);
    expect(await db.bookmarks.count()).toBe(0);
  });
  it("does not reveal bookmark or destination names in a privacy toast", async () => {
    state.privacy = true;
    await mount();
    paste("https://github.com");
    expect(await screen.findByText("Added Hidden bookmark to Board")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notifications" })).not.toHaveTextContent(/GitHub|github.com|Inbox/u);
  });
  it("reports an empty Page without adding", async () => {
    await mount();
    state.workspace = { ...state.workspace!, boards: [] };
    cleanup();
    render(<WorkspaceApp />);
    expect(paste("https://github.com").defaultPrevented).toBe(true);
    expect(await screen.findByText("Create a board first")).toBeInTheDocument();
    expect(await db.bookmarks.count()).toBe(0);
  });
  it("targets the board containing focus and the board under the pointer", async () => {
    const initial = await getWorkspaceData();
    const other = await createBoard(initial.pages[0]!.id, "Later");
    const view = await mount();
    const column = view.container.querySelector(`[data-board-id="${other.id}"]`)!;
    (column.querySelector("button") as HTMLElement).focus();
    paste("https://github.com");
    await waitFor(async () => expect((await getWorkspaceData()).bookmarks[0]?.boardId).toBe(other.id));
    (document.activeElement as HTMLElement).blur();
    fireEvent.pointerMove(column, { clientX: 15, clientY: 15 });
    paste("https://example.org");
    await waitFor(async () => expect((await getWorkspaceData()).bookmarks).toHaveLength(2));
    expect((await getWorkspaceData()).bookmarks.every((item) => item.boardId === other.id)).toBe(true);
  });
  it("uses first visually placed board as fallback in free layout", async () => {
    const initial = await getWorkspaceData();
    const other = await createBoard(initial.pages[0]!.id, "First visually");
    await db.boards.update(initial.boards[0]!.id, { gridRow: 1, gridColumn: 1 });
    await db.boards.update(other.id, { gridRow: 0, gridColumn: 1 });
    await updateSettings({ workspaceLayoutMode: "free" });
    await mount();
    paste("https://github.com");
    await waitFor(async () => expect((await getWorkspaceData()).bookmarks[0]?.boardId).toBe(other.id));
  });
  it("opens from the board menu after Duplicate and returns focus to the board on Escape", async () => {
    const view = await mount();
    const column = view.container.querySelector("[data-board-id]")!;
    fireEvent.contextMenu(column);
    const duplicate = screen.getByRole("menuitem", { name: "Duplicate" });
    const item = screen.getByRole("menuitem", { name: "Paste links…" });
    expect(duplicate.nextElementSibling).toBe(item);
    fireEvent.click(item);
    const dialog = await screen.findByRole("dialog", { name: "Paste links" });
    expect(within(dialog).getByRole("textbox")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(column).toContainElement(document.activeElement as HTMLElement);
  });
});
