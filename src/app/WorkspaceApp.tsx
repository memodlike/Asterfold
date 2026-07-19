import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import { Download, Sparkles, X } from "lucide-react";
import type { Board, Bookmark, Page, WorkspaceData } from "../domain/models";
import {
  bulkDeleteBookmarks,
  bulkMoveBookmarks,
  createBoard,
  createPage,
  duplicateBoard,
  duplicateBookmark,
  moveBoardToIndex,
  moveBookmarkToIndex,
  renamePage,
  restoreBoard,
  restoreBookmark,
  softDeleteBoard,
  softDeleteBookmark,
  updateBoard,
  updateSettings,
} from "../db/repository";
import { copyText, openUrl } from "../browser/api";
import { changeBus } from "../browser/changeBus";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { MoveDialog } from "../components/MoveDialog";
import { NameDialog } from "../components/NameDialog";
import { useToasts } from "../components/ToastRegion";
import { BoardCanvas } from "../features/boards/BoardCanvas";
import { useThemeRuntime } from "../features/appearance/useThemeRuntime";
import { I18nProvider, useI18n } from "../i18n";
import { AppLauncher } from "./AppLauncher";
import { useWorkspace } from "./useWorkspace";

const BookmarkEditor = lazy(async () => import("../features/bookmarks/BookmarkEditor").then((module) => ({ default: module.BookmarkEditor })));
const SearchPalette = lazy(async () => import("../features/search/SearchPalette").then((module) => ({ default: module.SearchPalette })));
const SettingsDialog = lazy(async () => import("../features/settings/SettingsDialog").then((module) => ({ default: module.SettingsDialog })));
const TrashDialog = lazy(async () => import("../features/trash/TrashDialog").then((module) => ({ default: module.TrashDialog })));

type SettingsSection = "appearance" | "layout" | "language" | "quick-save" | "data-privacy";
type NameIntent =
  | { kind: "new-page" }
  | { kind: "rename-page"; page: Page }
  | { kind: "new-board" }
  | { kind: "rename-board"; board: Board };
type MoveIntent = { kind: "bookmark"; bookmark: Bookmark } | { kind: "board"; board: Board } | { kind: "bulk" };
interface EditorIntent { bookmark: Bookmark | null; boardId: string }

export function WorkspaceApp() {
  const workspace = useWorkspace();
  if (!workspace) return <div className="app-loading"><Sparkles size={22} /><span>Открываем новую вкладку…</span></div>;
  return <I18nProvider preference={workspace.settings.locale} documentTitle="tab.title"><WorkspaceScreen workspace={workspace} /></I18nProvider>;
}

function WorkspaceScreen({ workspace }: { workspace: WorkspaceData }) {
  const { t } = useI18n();
  const toasts = useToasts();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("appearance");
  const [trashOpen, setTrashOpen] = useState(false);
  const [nameIntent, setNameIntent] = useState<NameIntent | null>(null);
  const [moveIntent, setMoveIntent] = useState<MoveIntent | null>(null);
  const [editor, setEditor] = useState<EditorIntent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [sessionPrivacy, setSessionPrivacy] = useState(false);
  const initialSettingsSeen = useRef(false);
  const appStyle = useThemeRuntime(workspace.settings.theme);

  useEffect(() => {
    if (initialSettingsSeen.current) return;
    initialSettingsSeen.current = true;
    performance.mark("asterfold-interactive");
    setSessionPrivacy(workspace.settings.privacyPersist && workspace.settings.privacyEnabled);
    if (!workspace.settings.onboardingComplete) void updateSettings({ onboardingComplete: true });
    const requestedPage = new URLSearchParams(location.search).get("page");
    if (requestedPage && workspace.pages.some((page) => page.id === requestedPage)) void updateSettings({ activePageId: requestedPage });
  }, [workspace.pages, workspace.settings.onboardingComplete, workspace.settings.privacyEnabled, workspace.settings.privacyPersist]);

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
  const activePage = workspace.pages.find((page) => page.id === workspace.settings.activePageId) ?? workspace.pages[0];
  if (!activePage) return <div className="app-loading">{t("loading.repairing")}</div>;
  const boards = workspace.boards.filter((board) => board.pageId === activePage.id);
  const boardIds = new Set(boards.map((board) => board.id));
  const bookmarks = workspace.bookmarks.filter((bookmark) => boardIds.has(bookmark.boardId));
  const privacy = workspace.settings.privacyPersist ? workspace.settings.privacyEnabled : sessionPrivacy;

  const run = async (action: () => Promise<unknown>, success?: string): Promise<void> => {
    try {
      await action();
      changeBus.publish("all");
      if (success) notifySuccess(success);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Не удалось выполнить действие");
    }
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
  const deleteBoard = (board: Board): void => {
    void run(async () => {
      await softDeleteBoard(board.id);
      toasts.push({ message: `${board.title} → ${t("generic.trash")}`, actionLabel: "Undo", onAction: async () => { await restoreBoard(board.id); changeBus.publish("board"); } });
    });
  };
  const deleteBookmark = (bookmark: Bookmark): void => {
    void run(async () => {
      await softDeleteBookmark(bookmark.id);
      setSelectedIds((current) => { const next = new Set(current); next.delete(bookmark.id); return next; });
      toasts.push({ message: `${bookmark.title} → ${t("generic.trash")}`, actionLabel: "Undo", onAction: async () => { await restoreBookmark(bookmark.id); changeBus.publish("bookmark"); } });
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
    if (privacy) { notifyError(t("privacy.clipboard")); return; }
    void copyText(bookmark.url).then(() => notifySuccess("URL copied")).catch(() => notifyError("Clipboard access failed"));
  };
  const copyMarkdown = (bookmark: Bookmark): void => {
    if (privacy) { notifyError(t("privacy.clipboard")); return; }
    void copyText(`[${bookmark.title}](${bookmark.url})`).then(() => notifySuccess("Markdown copied")).catch(() => notifyError("Clipboard access failed"));
  };
  const revealBookmark = (bookmark: Bookmark, pageId: string): void => {
    selectPage(pageId);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(bookmark.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 120);
  };
  const togglePrivacy = (): void => {
    const next = !privacy;
    if (workspace.settings.privacyPersist) void run(() => updateSettings({ privacyEnabled: next }), t(next ? "privacy.on" : "privacy.off"));
    else { setSessionPrivacy(next); notifySuccess(t(next ? "privacy.on" : "privacy.off")); }
  };
  const bulkDelete = (): void => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    void run(async () => {
      await bulkDeleteBookmarks(ids);
      setSelectedIds(new Set());
      toasts.push({ message: `${ids.length} → ${t("generic.trash")}`, actionLabel: "Undo", onAction: async () => { await Promise.all(ids.map((id) => restoreBookmark(id))); changeBus.publish("bookmark"); } });
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
    });
  };
  const saveRecentQuery = (query: string): void => {
    const next = [query, ...workspace.settings.recentQueries.filter((item) => item !== query)].slice(0, 10);
    void updateSettings({ recentQueries: next });
  };
  const openSettings = (section: SettingsSection): void => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };

  return (
    <div className={`app-shell ${privacy ? "privacy-mode" : ""} ${workspace.settings.theme.motion ? "" : "reduce-motion"}`} style={appStyle}>
      <div className="wallpaper" aria-hidden="true" />
      <BoardCanvas
        boards={boards}
        bookmarks={bookmarks}
        privacy={privacy}
        selectedIds={selectedIds}
        theme={workspace.settings.theme}
        settings={workspace.settings}
        onCreateBoard={() => setNameIntent({ kind: "new-board" })}
        onAddBookmark={(board) => setEditor({ bookmark: null, boardId: board.id })}
        onEditBoard={(board) => setNameIntent({ kind: "rename-board", board })}
        onPatchBoard={(board, patch) => void run(() => updateBoard(board.id, patch))}
        onMoveBoard={(board) => setMoveIntent({ kind: "board", board })}
        onDuplicateBoard={(board) => void run(() => duplicateBoard(board.id))}
        onDeleteBoard={deleteBoard}
        onMoveBoardIndex={(id, index, targetId) => void run(async () => {
          if (workspace.settings.workspaceLayoutMode === "free") {
            const source = boards.find((board) => board.id === id);
            const target = boards.find((board) => board.id === targetId);
            if (source && target) await Promise.all([
              updateBoard(source.id, { gridColumn: target.gridColumn, gridRow: target.gridRow }),
              updateBoard(target.id, { gridColumn: source.gridColumn, gridRow: source.gridRow }),
            ]);
          }
          await moveBoardToIndex(id, activePage.id, index);
        })}
        onOpenBookmark={openBookmark}
        onEditBookmark={(bookmark) => setEditor({ bookmark, boardId: bookmark.boardId })}
        onMoveBookmark={(bookmark) => setMoveIntent({ kind: "bookmark", bookmark })}
        onDuplicateBookmark={(bookmark) => void run(() => duplicateBookmark(bookmark.id))}
        onDeleteBookmark={deleteBookmark}
        onCopyUrl={copyUrl}
        onCopyMarkdown={copyMarkdown}
        onSelectBookmark={selectBookmark}
        onMoveBookmarkIndex={(id, boardId, index) => void run(() => moveBookmarkToIndex(id, boardId, index))}
        onImport={() => openSettings("data-privacy")}
      />
      <AppLauncher
        pages={workspace.pages}
        activePageId={activePage.id}
        privacy={privacy}
        onCreateBoard={() => setNameIntent({ kind: "new-board" })}
        onCreatePage={() => setNameIntent({ kind: "new-page" })}
        onSelectPage={selectPage}
        onSearch={() => setSearchOpen(true)}
        onPrivacy={togglePrivacy}
        onTrash={() => setTrashOpen(true)}
        onSettings={() => openSettings("appearance")}
      />
      {selectedIds.size > 0 ? <div className="bulk-toolbar"><strong>{selectedIds.size}</strong><Button size="small" onClick={() => setMoveIntent({ kind: "bulk" })}>{t("generic.move")}</Button><Button size="small" icon={<Download size={14} />} onClick={exportSelected}>Export</Button><Button size="small" variant="danger" onClick={bulkDelete}>{t("generic.delete")}</Button><IconButton label={t("generic.close")} onClick={() => setSelectedIds(new Set())}><X size={16} /></IconButton></div> : null}

      <Suspense fallback={null}>
        {searchOpen ? <SearchPalette open privacy={privacy} pages={workspace.pages} boards={workspace.boards} bookmarks={workspace.bookmarks} activePageId={activePage.id} onClose={() => setSearchOpen(false)} onOpen={openBookmark} onReveal={revealBookmark} onEdit={(bookmark) => setEditor({ bookmark, boardId: bookmark.boardId })} onMove={(bookmark) => setMoveIntent({ kind: "bookmark", bookmark })} onCopy={copyUrl} onDelete={deleteBookmark} onQueryCommitted={saveRecentQuery} /> : null}
        {editor !== null ? <BookmarkEditor open bookmark={editor.bookmark} initialBoardId={editor.boardId || boards[0]?.id || ""} pages={workspace.pages} boards={workspace.boards} onClose={() => setEditor(null)} onSaved={() => { changeBus.publish("bookmark"); notifySuccess(t("bookmark.saved")); }} onError={notifyError} /> : null}
      </Suspense>
      <NameDialog open={nameIntent !== null} title={t(nameIntent?.kind === "new-page" ? "name.newPage" : nameIntent?.kind === "rename-page" ? "name.renamePage" : nameIntent?.kind === "new-board" ? "name.newBoard" : "name.renameBoard")} label={t("generic.title")} initialValue={nameIntent && "page" in nameIntent ? nameIntent.page.title : nameIntent && "board" in nameIntent ? nameIntent.board.title : ""} submitLabel={t(nameIntent?.kind.startsWith("new-") ? "generic.create" : "generic.save")} onClose={() => setNameIntent(null)} onSubmit={handleNameSubmit} />
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
        }}
      />
      <Suspense fallback={null}>
        {settingsOpen ? <SettingsDialog open initialSection={settingsSection} workspace={workspace} onClose={() => setSettingsOpen(false)} onUpdated={notifySuccess} onError={notifyError} onOpenTrash={() => { setSettingsOpen(false); setTrashOpen(true); }} /> : null}
        {trashOpen ? <TrashDialog open onClose={() => setTrashOpen(false)} onChanged={(message) => { changeBus.publish("trash"); notifySuccess(message); }} onError={notifyError} /> : null}
      </Suspense>
      {toasts.region}
    </div>
  );
}
