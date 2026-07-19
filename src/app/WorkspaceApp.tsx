import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  BookmarkPlus,
  CheckCircle2,
  Download,
  FolderPlus,
  Import,
  Palette,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Board, Bookmark, Page } from "../domain/models";
import {
  bulkDeleteBookmarks,
  bulkMoveBookmarks,
  createBoard,
  createPage,
  duplicateBoard,
  duplicateBookmark,
  duplicatePage,
  moveBoardToIndex,
  moveBookmarkToIndex,
  movePageToIndex,
  renamePage,
  restoreBoard,
  restoreBookmark,
  restorePage,
  setDefaultPage,
  softDeleteBoard,
  softDeleteBookmark,
  softDeletePage,
  updateBoard,
  updateSettings,
} from "../db/repository";
import { copyText, openUrl } from "../browser/api";
import { changeBus } from "../browser/changeBus";
import { getThemePreset } from "../domain/themes";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { MoveDialog } from "../components/MoveDialog";
import { NameDialog } from "../components/NameDialog";
import { useToasts } from "../components/ToastRegion";
import { BoardCanvas } from "../features/boards/BoardCanvas";
import { PageSidebar } from "../features/pages/PageSidebar";
import { useThemeRuntime } from "../features/appearance/useThemeRuntime";
import { useWorkspace } from "./useWorkspace";
import { Onboarding } from "./Onboarding";

const BookmarkEditor = lazy(async () => import("../features/bookmarks/BookmarkEditor").then((module) => ({ default: module.BookmarkEditor })));
const SearchPalette = lazy(async () => import("../features/search/SearchPalette").then((module) => ({ default: module.SearchPalette })));
const SettingsDialog = lazy(async () => import("../features/settings/SettingsDialog").then((module) => ({ default: module.SettingsDialog })));
const TrashDialog = lazy(async () => import("../features/trash/TrashDialog").then((module) => ({ default: module.TrashDialog })));

type NameIntent =
  | { kind: "new-page" }
  | { kind: "rename-page"; page: Page }
  | { kind: "new-board" }
  | { kind: "rename-board"; board: Board };

type MoveIntent =
  | { kind: "bookmark"; bookmark: Bookmark }
  | { kind: "board"; board: Board }
  | { kind: "bulk" };

interface EditorIntent {
  bookmark: Bookmark | null;
  boardId: string;
}

export function WorkspaceApp() {
  const workspace = useWorkspace();
  const toasts = useToasts();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"general" | "appearance" | "import-export">("general");
  const [trashOpen, setTrashOpen] = useState(false);
  const [nameIntent, setNameIntent] = useState<NameIntent | null>(null);
  const [moveIntent, setMoveIntent] = useState<MoveIntent | null>(null);
  const [editor, setEditor] = useState<EditorIntent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [sessionPrivacy, setSessionPrivacy] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const initialSettingsSeen = useRef(false);
  const appStyle = useThemeRuntime(workspace?.settings.theme);

  useEffect(() => {
    if (!workspace || initialSettingsSeen.current) return;
    initialSettingsSeen.current = true;
    performance.mark("asterfold-interactive");
    setSessionPrivacy(workspace.settings.privacyPersist && workspace.settings.privacyEnabled);
    setOnboardingOpen(!workspace.settings.onboardingComplete);
    const requestedPage = new URLSearchParams(location.search).get("page");
    if (requestedPage && workspace.pages.some((page) => page.id === requestedPage)) void updateSettings({ activePageId: requestedPage });
  }, [workspace]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const notifyError = (message: string): void => toasts.push({ message, tone: "error" });
  const notifySuccess = (message: string): void => toasts.push({ message, tone: "success" });
  if (!workspace) return <div className="app-loading"><Sparkles size={25} /><span>Opening Asterfold…</span></div>;

  const activePage = workspace.pages.find((page) => page.id === workspace.settings.activePageId) ?? workspace.pages[0];
  if (!activePage) return <div className="app-loading">Repairing workspace…</div>;
  const boards = workspace.boards.filter((board) => board.pageId === activePage.id);
  const boardIds = new Set(boards.map((board) => board.id));
  const bookmarks = workspace.bookmarks.filter((bookmark) => boardIds.has(bookmark.boardId));
  const privacy = workspace.settings.privacyPersist ? workspace.settings.privacyEnabled : sessionPrivacy;

  const run = async (action: () => Promise<unknown>, success?: string): Promise<void> => {
    try {
      await action();
      changeBus.publish("all");
      if (success) notifySuccess(success);
    } catch (error) { notifyError(error instanceof Error ? error.message : "The action could not be completed"); }
  };

  const selectPage = (id: string): void => {
    setSelectedIds(new Set());
    void run(() => updateSettings({ activePageId: id }));
  };
  const handleNameSubmit = async (value: string): Promise<void> => {
    const intent = nameIntent;
    if (!intent) return;
    if (intent.kind === "new-page") await createPage(value);
    if (intent.kind === "rename-page") await renamePage(intent.page.id, value);
    if (intent.kind === "new-board") await createBoard(activePage.id, value);
    if (intent.kind === "rename-board") await updateBoard(intent.board.id, { title: value });
    changeBus.publish(intent.kind.includes("page") ? "page" : "board");
  };
  const deletePage = (page: Page): void => {
    void run(async () => {
      await softDeletePage(page.id);
      toasts.push({ message: `${page.title} moved to Trash`, actionLabel: "Undo", onAction: async () => { await restorePage(page.id); changeBus.publish("page"); } });
    });
  };
  const deleteBoard = (board: Board): void => {
    void run(async () => {
      await softDeleteBoard(board.id);
      toasts.push({ message: `${board.title} moved to Trash`, actionLabel: "Undo", onAction: async () => { await restoreBoard(board.id); changeBus.publish("board"); } });
    });
  };
  const deleteBookmark = (bookmark: Bookmark): void => {
    void run(async () => {
      await softDeleteBookmark(bookmark.id);
      setSelectedIds((current) => { const next = new Set(current); next.delete(bookmark.id); return next; });
      toasts.push({ message: `${bookmark.title} moved to Trash`, actionLabel: "Undo", onAction: async () => { await restoreBookmark(bookmark.id); changeBus.publish("bookmark"); } });
    });
  };
  const openBookmark = (bookmark: Bookmark): void => { void run(() => openUrl(bookmark.url, bookmark.openMode)); };
  const selectBookmark = (bookmark: Bookmark, event: MouseEvent): void => {
    setSelectedIds((current) => {
      const next = new Set(event.ctrlKey || event.metaKey || event.shiftKey ? current : []);
      if (event.shiftKey && lastSelectedId) {
        const sameBoard = bookmarks.filter((item) => item.boardId === bookmark.boardId);
        const from = sameBoard.findIndex((item) => item.id === lastSelectedId);
        const to = sameBoard.findIndex((item) => item.id === bookmark.id);
        if (from >= 0 && to >= 0) for (const item of sameBoard.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(item.id);
      } else if (next.has(bookmark.id)) next.delete(bookmark.id);
      else next.add(bookmark.id);
      return next;
    });
    setLastSelectedId(bookmark.id);
  };
  const copyUrl = (bookmark: Bookmark): void => {
    if (privacy) { notifyError("Clipboard actions are protected in Privacy Mode"); return; }
    void copyText(bookmark.url).then(() => notifySuccess("URL copied")).catch(() => notifyError("Clipboard access failed"));
  };
  const copyMarkdown = (bookmark: Bookmark): void => {
    if (privacy) { notifyError("Clipboard actions are protected in Privacy Mode"); return; }
    void copyText(`[${bookmark.title}](${bookmark.url})`).then(() => notifySuccess("Markdown copied")).catch(() => notifyError("Clipboard access failed"));
  };
  const revealBookmark = (bookmark: Bookmark, pageId: string): void => {
    selectPage(pageId);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(bookmark.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 120);
  };
  const togglePrivacy = (): void => {
    const next = !privacy;
    if (workspace.settings.privacyPersist) void run(() => updateSettings({ privacyEnabled: next }), next ? "Privacy Mode on" : "Privacy Mode off");
    else { setSessionPrivacy(next); notifySuccess(next ? "Privacy Mode on for this session" : "Privacy Mode off"); }
  };
  const cycleTheme = (): void => {
    const next = workspace.settings.theme.preset === "frost-light" ? "graphite-dark" : "frost-light";
    void run(() => updateSettings({ theme: getThemePreset(next) }), `${next === "frost-light" ? "Frost Light" : "Graphite Dark"} applied`);
  };
  const bulkDelete = (): void => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    void run(async () => {
      await bulkDeleteBookmarks(ids);
      setSelectedIds(new Set());
      toasts.push({ message: `${ids.length} bookmarks moved to Trash`, actionLabel: "Undo", onAction: async () => { await Promise.all(ids.map((id) => restoreBookmark(id))); changeBus.publish("bookmark"); } });
    });
  };
  const exportSelected = (): void => {
    const ids = new Set(selectedIds);
    void run(async () => {
      const { createBackup, downloadText, serializeBackup } = await import("../services/exportImport");
      const backup = await createBackup();
      backup.entities.bookmarks = backup.entities.bookmarks.filter((bookmark) => ids.has(bookmark.id));
      const selectedBoardIds = new Set(backup.entities.bookmarks.map((bookmark) => bookmark.boardId));
      backup.entities.boards = backup.entities.boards.filter((board) => selectedBoardIds.has(board.id));
      const selectedPageIds = new Set(backup.entities.boards.map((board) => board.pageId));
      backup.entities.pages = backup.entities.pages.filter((page) => selectedPageIds.has(page.id));
      backup.scope = "board";
      downloadText("asterfold-selection.json", serializeBackup(backup), "application/json");
    }, "Selection exported");
  };
  const saveRecentQuery = (query: string): void => {
    const next = [query, ...workspace.settings.recentQueries.filter((item) => item !== query)].slice(0, 10);
    void updateSettings({ recentQueries: next });
  };

  return (
    <div className={`app-shell ${privacy ? "privacy-mode" : ""} ${workspace.settings.theme.motion ? "" : "reduce-motion"}`} style={appStyle}>
      <div className="wallpaper" aria-hidden="true" />
      <PageSidebar
        pages={workspace.pages}
        activePageId={activePage.id}
        expanded={workspace.settings.navigationMode === "expanded"}
        onSelect={selectPage}
        onCreate={() => setNameIntent({ kind: "new-page" })}
        onRename={(page) => setNameIntent({ kind: "rename-page", page })}
        onDuplicate={(page) => void run(() => duplicatePage(page.id), "Page duplicated")}
        onDelete={deletePage}
        onSetDefault={(page) => void run(() => setDefaultPage(page.id), "Default Page updated")}
        onMove={(id, index) => void run(() => movePageToIndex(id, index))}
        onToggleExpanded={() => void run(() => updateSettings({ navigationMode: workspace.settings.navigationMode === "expanded" ? "rail" : "expanded" }))}
      />
      <section className="workspace">
        <header className="topbar">
          <div className="topbar__page"><h1>{activePage.title}</h1><span>{boards.length} boards · {bookmarks.length} bookmarks</span></div>
          <button className="command-button" onClick={() => setSearchOpen(true)}><Search size={19} /><span>{privacy ? "Search protected" : "Search bookmarks or run a command…"}</span><kbd>⌘ K</kbd></button>
          <div className="topbar__utilities">
            <details className="menu add-menu"><summary className="icon-button" aria-label="Add"><Plus size={20} /></summary><div className="menu__popover menu__popover--right"><button onClick={() => setEditor({ bookmark: null, boardId: boards[0]?.id ?? "" })}><BookmarkPlus size={16} />Add bookmark</button><button onClick={() => setNameIntent({ kind: "new-board" })}><FolderPlus size={16} />Add board</button><button onClick={() => setNameIntent({ kind: "new-page" })}><Plus size={16} />Add Page</button><button onClick={() => { setSettingsSection("import-export"); setSettingsOpen(true); }}><Import size={16} />Import</button></div></details>
            <IconButton label={privacy ? "Turn Privacy Mode off" : "Turn Privacy Mode on"} active={privacy} onClick={togglePrivacy}><ShieldCheck size={19} /></IconButton>
            <IconButton label="Switch light/dark theme" onClick={cycleTheme}><Palette size={19} /></IconButton>
            <IconButton label="Trash" onClick={() => setTrashOpen(true)}><Trash2 size={19} /></IconButton>
            <IconButton label="Settings" onClick={() => { setSettingsSection("general"); setSettingsOpen(true); }}><Settings size={19} /></IconButton>
          </div>
        </header>
        {privacy ? <div className="privacy-indicator"><ShieldCheck size={15} /><span>Privacy on</span><button onClick={togglePrivacy}>Turn off</button></div> : null}
        {selectedIds.size > 0 ? <div className="bulk-toolbar"><strong>{selectedIds.size} selected</strong><Button size="small" onClick={() => setMoveIntent({ kind: "bulk" })}>Move</Button><Button size="small" icon={<Download size={14} />} onClick={exportSelected}>Export</Button><Button size="small" variant="danger" onClick={bulkDelete}>Delete</Button><IconButton label="Clear selection" onClick={() => setSelectedIds(new Set())}><X size={16} /></IconButton></div> : null}
        <BoardCanvas
          boards={boards}
          bookmarks={bookmarks}
          privacy={privacy}
          selectedIds={selectedIds}
          theme={workspace.settings.theme}
          onCreateBoard={() => setNameIntent({ kind: "new-board" })}
          onAddBookmark={(board) => setEditor({ bookmark: null, boardId: board.id })}
          onEditBoard={(board) => setNameIntent({ kind: "rename-board", board })}
          onMoveBoard={(board) => setMoveIntent({ kind: "board", board })}
          onDuplicateBoard={(board) => void run(() => duplicateBoard(board.id), "Board duplicated")}
          onDeleteBoard={deleteBoard}
          onToggleBoard={(board) => void run(() => updateBoard(board.id, { collapsed: !board.collapsed }))}
          onToggleLayout={(board) => void run(() => updateBoard(board.id, { layout: board.layout === "list" ? "grid" : "list" }))}
          onMoveBoardIndex={(id, index) => void run(() => moveBoardToIndex(id, activePage.id, index))}
          onOpenBookmark={openBookmark}
          onEditBookmark={(bookmark) => setEditor({ bookmark, boardId: bookmark.boardId })}
          onMoveBookmark={(bookmark) => setMoveIntent({ kind: "bookmark", bookmark })}
          onDuplicateBookmark={(bookmark) => void run(() => duplicateBookmark(bookmark.id), "Bookmark duplicated")}
          onDeleteBookmark={deleteBookmark}
          onCopyUrl={copyUrl}
          onCopyMarkdown={copyMarkdown}
          onSelectBookmark={selectBookmark}
          onMoveBookmarkIndex={(id, boardId, index) => void run(() => moveBookmarkToIndex(id, boardId, index))}
          onImport={() => { setSettingsSection("import-export"); setSettingsOpen(true); }}
        />
      </section>

      <Suspense fallback={null}>
        {searchOpen ? <SearchPalette open privacy={privacy} pages={workspace.pages} boards={workspace.boards} bookmarks={workspace.bookmarks} activePageId={activePage.id} onClose={() => setSearchOpen(false)} onOpen={openBookmark} onReveal={revealBookmark} onEdit={(bookmark) => setEditor({ bookmark, boardId: bookmark.boardId })} onMove={(bookmark) => setMoveIntent({ kind: "bookmark", bookmark })} onCopy={copyUrl} onDelete={deleteBookmark} onQueryCommitted={saveRecentQuery} /> : null}
        {editor !== null ? <BookmarkEditor open bookmark={editor.bookmark} initialBoardId={editor.boardId || boards[0]?.id || ""} pages={workspace.pages} boards={workspace.boards} onClose={() => setEditor(null)} onSaved={() => { changeBus.publish("bookmark"); notifySuccess("Bookmark saved locally"); }} onError={notifyError} /> : null}
      </Suspense>
      <NameDialog open={nameIntent !== null} title={nameIntent?.kind === "new-page" ? "Create Page" : nameIntent?.kind === "rename-page" ? "Rename Page" : nameIntent?.kind === "new-board" ? "Create Board" : "Rename Board"} label="Name" initialValue={nameIntent && "page" in nameIntent ? nameIntent.page.title : nameIntent && "board" in nameIntent ? nameIntent.board.title : ""} submitLabel={nameIntent?.kind.startsWith("new-") ? "Create" : "Save"} onClose={() => setNameIntent(null)} onSubmit={handleNameSubmit} />
      <MoveDialog
        open={moveIntent !== null}
        type={moveIntent?.kind === "board" ? "board" : moveIntent?.kind === "bulk" ? "bulk-bookmarks" : "bookmark"}
        pages={workspace.pages}
        boards={workspace.boards}
        currentId={moveIntent?.kind === "board" ? moveIntent.board.pageId : moveIntent?.kind === "bookmark" ? moveIntent.bookmark.boardId : undefined}
        onClose={() => setMoveIntent(null)}
        onMove={async (destinationId) => {
          if (moveIntent?.kind === "board") await moveBoardToIndex(moveIntent.board.id, destinationId, Number.MAX_SAFE_INTEGER);
          if (moveIntent?.kind === "bookmark") await moveBookmarkToIndex(moveIntent.bookmark.id, destinationId, Number.MAX_SAFE_INTEGER);
          if (moveIntent?.kind === "bulk") { await bulkMoveBookmarks([...selectedIds], destinationId); setSelectedIds(new Set()); }
          changeBus.publish("all");
          notifySuccess("Moved successfully");
        }}
      />
      <Suspense fallback={null}>
        {settingsOpen ? <SettingsDialog open initialSection={settingsSection} workspace={workspace} onClose={() => setSettingsOpen(false)} onUpdated={notifySuccess} onError={notifyError} onOpenTrash={() => { setSettingsOpen(false); setTrashOpen(true); }} /> : null}
        {trashOpen ? <TrashDialog open onClose={() => setTrashOpen(false)} onChanged={(message) => { changeBus.publish("trash"); notifySuccess(message); }} onError={notifyError} /> : null}
      </Suspense>
      <Onboarding open={onboardingOpen} onClose={() => { setOnboardingOpen(false); void updateSettings({ onboardingComplete: true }); }} onChooseTheme={(preset) => void updateSettings({ theme: getThemePreset(preset) })} onImport={() => { setOnboardingOpen(false); void updateSettings({ onboardingComplete: true }); setSettingsSection("import-export"); setSettingsOpen(true); }} />
      {toasts.region}
      <div className="saved-status"><CheckCircle2 size={15} /><span>Saved locally</span></div>
    </div>
  );
}
