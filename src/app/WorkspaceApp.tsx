import { WorkspaceLimitError } from "../domain/errors";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { Download, Sparkles, X } from "lucide-react";
import type { Board, Bookmark, Page, WorkspaceData } from "../domain/models";
import {
  bulkDeleteBookmarks,
  bulkMoveBookmarks,
  bulkRestoreBookmarks,
  createBoard,
  createBookmarksBulk,
  createPage,
  duplicateBoard,
  duplicateBookmark,
  duplicatePage,
  moveBoardToIndex,
  moveBoardWithGridSwap,
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
import { copyText, ExtensionRequestError, openUrl, openUrls } from "../browser/api";
import { isSafeOpenUrl } from "../domain/urls";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { Modal } from "../components/Modal";
import { MoveDialog } from "../components/MoveDialog";
import { NameDialog } from "../components/NameDialog";
import { useToasts } from "../components/ToastRegion";
import { BoardCanvas } from "../features/boards/BoardCanvas";
import { useThemeRuntime } from "../features/appearance/useThemeRuntime";
import { I18nProvider, translate, useI18n } from "../i18n";
import { AppLauncher } from "./AppLauncher";
import { useWorkspace } from "./useWorkspace";
import { usePrivacyMode } from "./usePrivacyMode";
import { analyzePastedLinks } from "../domain/pasteLinks";
import { PasteLinksDialog } from "../features/bookmarks/PasteLinksDialog";
import { packBoards } from "../features/boards/layout";

const loadBookmarkEditor = async () => import("../features/bookmarks/BookmarkEditor").then((module) => ({ default: module.BookmarkEditor }));
const loadSearchPalette = async () => import("../features/search/SearchPalette").then((module) => ({ default: module.SearchPalette }));
const loadSettingsDialog = async () => import("../features/settings/SettingsDialog").then((module) => ({ default: module.SettingsDialog }));
const loadTrashDialog = async () => import("../features/trash/TrashDialog").then((module) => ({ default: module.TrashDialog }));
const BookmarkEditor = lazy(loadBookmarkEditor);
const SearchPalette = lazy(loadSearchPalette);
const SettingsDialog = lazy(loadSettingsDialog);
const TrashDialog = lazy(loadTrashDialog);

type SettingsSection = "appearance" | "layout" | "language" | "data-privacy";
type NameIntent =
  | { kind: "new-page" }
  | { kind: "rename-page"; page: Page }
  | { kind: "new-board" }
  | { kind: "rename-board"; board: Board };
type MoveIntent = { kind: "bookmark"; bookmark: Bookmark } | { kind: "board"; board: Board } | { kind: "bulk" };
interface EditorIntent { bookmark: Bookmark | null; boardId: string }
interface OpenBoardIntent { urls: string[]; mode: "new-tabs" | "new-window"; count: number; truncated: boolean }

export function WorkspaceApp() {
  const { workspace, failed, retry } = useWorkspace();
  if (failed) return <div className="app-loading"><span>{translate("auto", "error.actionFailed")}</span><Button onClick={retry}>{translate("auto", "generic.retry")}</Button></div>;
  if (!workspace) return <div className="app-loading"><Sparkles size={22} /><span>{translate("auto", "loading.opening")}</span></div>;
  return <I18nProvider preference={workspace.settings.locale} documentTitle="tab.title"><WorkspaceScreen workspace={workspace} /></I18nProvider>;
}

function WorkspaceScreen({ workspace }: { workspace: WorkspaceData }) {
  const { t } = useI18n();
  const { privacy, setPrivacy } = usePrivacyMode(workspace.settings);
  const toasts = useToasts(privacy);
  const { push: pushToast } = toasts;
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("appearance");
  const [trashOpen, setTrashOpen] = useState(false);
  const [nameIntent, setNameIntent] = useState<NameIntent | null>(null);
  const [moveIntent, setMoveIntent] = useState<MoveIntent | null>(null);
  const [editor, setEditor] = useState<EditorIntent | null>(null);
  const [openBoardIntent, setOpenBoardIntent] = useState<OpenBoardIntent | null>(null);
  const openBoardConfirmId = useId();
  const [pasteIntent, setPasteIntent] = useState<{ boardId: string; text: string } | null>(null);
  const pointer = useRef<{ x: number; y: number; boardId: string | null } | null>(null);
  const [pendingReveal, setPendingReveal] = useState<{ bookmarkId: string; pageId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const initialSettingsSeen = useRef(false);
  const performanceMode = useThemeRuntime(workspace.settings.theme);
  const privacyRef = useRef(privacy);
  useEffect(() => { privacyRef.current = privacy; }, [privacy]);
  const blockingOverlayOpen = pasteIntent !== null || searchOpen || settingsOpen || trashOpen || nameIntent !== null || moveIntent !== null || editor !== null || openBoardIntent !== null;

  useEffect(() => {
    const preload = (): void => { void Promise.allSettled([loadSearchPalette(), loadSettingsDialog(), loadTrashDialog(), loadBookmarkEditor()]); };
    const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback) => number; cancelIdleCallback?: (handle: number) => void };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload);
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(preload, 250);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (initialSettingsSeen.current) return;
    initialSettingsSeen.current = true;
    performance.mark("asterfold-interactive");
    const requestedPage = new URLSearchParams(location.search).get("page");
    if (requestedPage && workspace.pages.some((page) => page.id === requestedPage)) void updateSettings({ activePageId: requestedPage });
  }, [workspace.pages]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!blockingOverlayOpen) setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [blockingOverlayOpen]);

  const notifyError = (message: string): void => toasts.push({ message, tone: "error" });
  const notifySuccess = (message: string): void => toasts.push({ message, tone: "success" });
  const activePage = workspace.pages.find((page) => page.id === workspace.settings.activePageId) ?? workspace.pages[0];
  const activePageId = activePage?.id;
  const [prevActivePageId, setPrevActivePageId] = useState(activePageId);
  if (prevActivePageId !== activePageId) {
    setPrevActivePageId(activePageId);
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }
  const pasteCreated = useCallback((created: Bookmark[], board: Board, single = false): void => {
    if (created.length === 0) {
      pushToast({ message: t("paste.already") });
      return;
    }
    pushToast({
      message: single
        ? t("paste.addedOne", { title: created[0]!.title, board: board.title })
        : t("paste.addedMany", { count: created.length, board: board.title }),
      privacyMessage: single
        ? t("paste.addedOne", { title: t("privacy.hiddenBookmark"), board: t("generic.board") })
        : t("paste.addedMany", { count: created.length, board: t("generic.board") }),
      tone: "success",
      actionLabel: t("generic.undo"),
      onAction: () => bulkDeleteBookmarks(created.map((bookmark) => bookmark.id)),
    });
  }, [t, pushToast]);

  useEffect(() => {
    const trackPointer = (event: PointerEvent): void => {
      const board = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-board-id]") : null;
      pointer.current = { x: event.clientX, y: event.clientY, boardId: board?.dataset.boardId ?? null };
    };
    const clearPointer = (): void => { pointer.current = null; };
    window.addEventListener("pointermove", trackPointer, { passive: true });
    window.addEventListener("pointerover", trackPointer, { passive: true });
    document.addEventListener("pointerleave", clearPointer);
    window.addEventListener("blur", clearPointer);
    return () => {
      window.removeEventListener("pointermove", trackPointer);
      window.removeEventListener("pointerover", trackPointer);
      document.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("blur", clearPointer);
    };
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented || blockingOverlayOpen
        || target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
        || document.querySelector("[role='dialog'], [role='menu'], [role='listbox'], .overlay-loading")) return;
      if (!event.clipboardData?.types.includes("text/plain")) return;
      const text = event.clipboardData.getData("text/plain");
      const analysis = analyzePastedLinks(text);
      if (analysis.urls.length === 0) return;
      const pageBoards = workspace.boards.filter((board) => board.pageId === activePageId);
      const focusedId = document.activeElement?.closest<HTMLElement>("[data-board-id]")?.dataset.boardId;
      const location = pointer.current;
      const hoveredId = location && typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(location.x, location.y)?.closest<HTMLElement>("[data-board-id]")?.dataset.boardId
        : location?.boardId;
      const counts = new Map<string, number>();
      for (const bookmark of workspace.bookmarks) counts.set(bookmark.boardId, (counts.get(bookmark.boardId) ?? 0) + 1);
      const { placements } = packBoards(pageBoards, counts, workspace.settings.workspaceRows, workspace.settings.workspaceLayoutMode === "free");
      const visualBoards = [...pageBoards].sort((left, right) => {
        const a = placements.get(left.id)!;
        const b = placements.get(right.id)!;
        return a.row - b.row || a.column - b.column;
      });
      const board = pageBoards.find((item) => item.id === focusedId)
        ?? pageBoards.find((item) => item.id === hoveredId) ?? visualBoards[0];
      event.preventDefault();
      if (!board) {
        pushToast({ message: t("paste.noBoard"), tone: "neutral" });
        return;
      }
      if (analysis.urls.length > 1) {
        setPasteIntent({ boardId: board.id, text });
        return;
      }
      void createBookmarksBulk(board.id, analysis.items)
        .then((created) => pasteCreated(created, board, true))
        .catch((error: unknown) => pushToast({ message: t(error instanceof WorkspaceLimitError ? "error.workspaceLimit" : "paste.failed"), tone: "error" }));
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activePageId, blockingOverlayOpen, pasteCreated, t, pushToast, workspace]);

  useEffect(() => {
    if (!pendingReveal || !activePageId || activePageId !== pendingReveal.pageId) return;
    const target = document.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(pendingReveal.bookmarkId)}"]`);
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !workspace.settings.theme.motion;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "center" });
    setPendingReveal(null);
  }, [activePageId, pendingReveal, workspace.bookmarks, workspace.settings.theme.motion]);

  const boards = useMemo(() => (activePage ? workspace.boards.filter((board) => board.pageId === activePage.id) : []), [activePage, workspace.boards]);
  const boardIds = useMemo(() => new Set(boards.map((board) => board.id)), [boards]);
  const bookmarks = useMemo(() => (activePage ? workspace.bookmarks.filter((bookmark) => boardIds.has(bookmark.boardId)) : []), [activePage, boardIds, workspace.bookmarks]);

  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) return current;
      const validIds = new Set(bookmarks.map((item) => item.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : current;
    });
    setLastSelectedId((current) => (current && bookmarks.some((item) => item.id === current) ? current : null));
  }, [bookmarks]);

  if (!activePage) return <div className="app-loading">{t("loading.repairing")}</div>;

  const run = async (action: () => Promise<unknown>, success?: string): Promise<void> => {
    try {
      await action();
      if (success) notifySuccess(success);
    } catch (error) {
      if (error instanceof ExtensionRequestError) {
        const key = error.code === "UNSAFE_URL"
          ? "error.navigationUnsafe"
          : error.code === "INCOGNITO_UNAVAILABLE"
            ? "error.incognitoUnavailable"
            : "error.navigationFailed";
        notifyError(t(key));
      } else {
        notifyError(t(error instanceof WorkspaceLimitError ? "error.workspaceLimit" : "error.actionFailed"));
      }
    }
  };
  const selectPage = (id: string): void => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
    void run(() => updateSettings({ activePageId: id }));
  };
  const handleNameSubmit = async (value: string): Promise<void> => {
    const intent = nameIntent;
    if (!intent) return;
    if (intent.kind === "new-page") {
      setSelectedIds(new Set());
      setLastSelectedId(null);
      await createPage(value);
    }
    if (intent.kind === "rename-page") await renamePage(intent.page.id, value);
    if (intent.kind === "new-board") await createBoard(activePage.id, value);
    if (intent.kind === "rename-board") await updateBoard(intent.board.id, { title: value });
  };
  const deleteBoard = (board: Board): void => {
    void run(async () => {
      await softDeleteBoard(board.id);
      toasts.push({
        message: `${board.title} → ${t("generic.trash")}`,
        privacyMessage: `${t("generic.board")} → ${t("generic.trash")}`,
        actionLabel: t("generic.undo"),
        onAction: async () => { await restoreBoard(board.id); },
      });
    });
  };
  const deleteBookmark = (bookmark: Bookmark): void => {
    void run(async () => {
      await softDeleteBookmark(bookmark.id);
      setSelectedIds((current) => { const next = new Set(current); next.delete(bookmark.id); return next; });
      toasts.push({
        message: `${bookmark.title} → ${t("generic.trash")}`,
        privacyMessage: `${t("privacy.hiddenBookmark")} → ${t("generic.trash")}`,
        actionLabel: t("generic.undo"),
        onAction: async () => { await restoreBookmark(bookmark.id); },
      });
    });
  };
  const deletePage = (page: Page): void => {
    void run(async () => {
      await softDeletePage(page.id);
      toasts.push({
        message: `${page.title} → ${t("generic.trash")}`,
        privacyMessage: `${t("generic.page")} → ${t("generic.trash")}`,
        actionLabel: t("generic.undo"),
        onAction: async () => { await restorePage(page.id); },
      });
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
    void copyText(bookmark.url).then(() => notifySuccess(t("bookmark.copyUrl"))).catch(() => notifyError(t("error.actionFailed")));
  };
  const copyMarkdown = (bookmark: Bookmark): void => {
    if (privacy) { notifyError(t("privacy.clipboard")); return; }
    void copyText(`[${bookmark.title}](${bookmark.url})`).then(() => notifySuccess(t("bookmark.copyMarkdown"))).catch(() => notifyError(t("error.actionFailed")));
  };
  const revealBookmark = (bookmark: Bookmark, pageId: string): void => {
    setPendingReveal({ bookmarkId: bookmark.id, pageId });
    selectPage(pageId);
  };
  const togglePrivacy = (): void => {
    const next = !privacy;
    void run(() => setPrivacy(next), t(next ? "privacy.on" : "privacy.off"));
  };
  const bulkDelete = (): void => {
    const validIds = new Set(bookmarks.map((b) => b.id));
    const ids = [...selectedIds].filter((id) => validIds.has(id));
    if (!ids.length) {
      setSelectedIds(new Set());
      return;
    }
    void run(async () => {
      await bulkDeleteBookmarks(ids);
      setSelectedIds(new Set());
      toasts.push({ message: `${ids.length} → ${t("generic.trash")}`, actionLabel: t("generic.undo"), onAction: async () => { await bulkRestoreBookmarks(ids); } });
    });
  };
  const exportSelected = (): void => {
    const validIds = new Set(bookmarks.map((b) => b.id));
    const ids = [...selectedIds].filter((id) => validIds.has(id));
    if (!ids.length) {
      setSelectedIds(new Set());
      return;
    }
    void run(async () => {
      const { createSelectionBackup, downloadText, serializeBackup } = await import("../services/exportImport");
      const backup = await createSelectionBackup(ids);
      downloadText("asterfold-selection.json", serializeBackup(backup), "application/json");
    });
  };
  const openSettings = (section: SettingsSection): void => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };

  const executeOpenBoard = async (urls: string[], mode: "new-tabs" | "new-window", truncated: boolean): Promise<void> => {
    const success = truncated ? t("board.openAllTruncated", { count: urls.length }) : t("board.openAllDone", { count: urls.length });
    await run(async () => {
      await openUrls(urls, mode);
    }, success);
  };
  const openBoard = (targetBoard: Board, mode: "new-tabs" | "new-window"): void => {
    const boardBookmarks = bookmarks.filter((item) => item.boardId === targetBoard.id);
    const openableUrls = boardBookmarks.filter((item) => isSafeOpenUrl(item.url)).map((item) => item.url);
    if (openableUrls.length === 0) {
      notifyError(t("board.openAllNone"));
      return;
    }
    const truncated = openableUrls.length > 50;
    const urlsToOpen = openableUrls.slice(0, 50);
    if (urlsToOpen.length > 12) {
      setOpenBoardIntent({ urls: urlsToOpen, mode, count: urlsToOpen.length, truncated });
      return;
    }
    void executeOpenBoard(urlsToOpen, mode, truncated);
  };

  return (
    <div className={`app-shell performance-${performanceMode} ${performanceMode === "compatibility" || performanceMode === "software" ? "low-power-mode" : ""} ${privacy ? "privacy-mode" : ""} ${workspace.settings.theme.motion ? "" : "motion-disabled"} ${workspace.settings.theme.bookmarkHoverMotion ? "" : "motion-hover-disabled"} ${workspace.settings.theme.menuMotion ? "" : "motion-menu-disabled"} ${workspace.settings.theme.dragMotion ? "" : "motion-drag-disabled"}`}>
      <div className="wallpaper" aria-hidden="true" />
      <BoardCanvas
        boards={boards}
        bookmarks={bookmarks}
        privacy={privacy}
        selectedIds={selectedIds}
        settings={workspace.settings}
        onCreateBoard={() => setNameIntent({ kind: "new-board" })}
        onPasteLinks={(board) => setPasteIntent({ boardId: board.id, text: "" })}
        onAddBookmark={(board) => setEditor({ bookmark: null, boardId: board.id })}
        onEditBoard={(board) => setNameIntent({ kind: "rename-board", board })}
        onPatchBoard={(board, patch) => void run(() => updateBoard(board.id, patch))}
        onMoveBoard={(board) => setMoveIntent({ kind: "board", board })}
        onOpenBoard={openBoard}
        onDuplicateBoard={(board) => void run(() => duplicateBoard(board.id))}
        onDeleteBoard={deleteBoard}
        onMoveBoardIndex={(id, index, targetId) => void run(() => workspace.settings.workspaceLayoutMode === "free"
          ? moveBoardWithGridSwap(id, targetId, activePage.id, index)
          : moveBoardToIndex(id, activePage.id, index))}
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
        pageStats={{ boards: boards.length, bookmarks: bookmarks.length }}
        onCreateBoard={() => setNameIntent({ kind: "new-board" })}
        onCreatePage={() => setNameIntent({ kind: "new-page" })}
        onSelectPage={selectPage}
        onRenamePage={(page) => setNameIntent({ kind: "rename-page", page })}
        onDuplicatePage={(page) => void run(() => duplicatePage(page.id))}
        onDefaultPage={(page) => void run(() => setDefaultPage(page.id))}
        onMovePage={(page, targetIndex) => void run(() => movePageToIndex(page.id, targetIndex))}
        onDeletePage={deletePage}
        onSearch={() => { if (!blockingOverlayOpen) setSearchOpen(true); }}
        onPrivacy={togglePrivacy}
        onTrash={() => setTrashOpen(true)}
        onSettings={() => openSettings("appearance")}
        showFirstRunHint={!workspace.settings.onboardingComplete}
        onDismissFirstRunHint={() => { void run(() => updateSettings({ onboardingComplete: true })); }}
      />
      {selectedIds.size > 0 ? <div className="bulk-toolbar"><strong>{selectedIds.size}</strong><Button size="small" onClick={() => setMoveIntent({ kind: "bulk" })}>{t("generic.move")}</Button><Button size="small" icon={<Download size={14} />} onClick={exportSelected}>{t("generic.export")}</Button><Button size="small" variant="danger" onClick={bulkDelete}>{t("generic.delete")}</Button><IconButton label={t("generic.close")} onClick={() => setSelectedIds(new Set())}><X size={16} /></IconButton></div> : null}

      <Suspense fallback={<div className="overlay-loading" role="status" aria-label={t("loading.opening")} />}>
        {searchOpen ? <SearchPalette open privacy={privacy} pages={workspace.pages} boards={workspace.boards} bookmarks={workspace.bookmarks} activePageId={activePage.id} onClose={() => setSearchOpen(false)} onOpen={openBookmark} onReveal={revealBookmark} onEdit={(bookmark) => { setSearchOpen(false); setEditor({ bookmark, boardId: bookmark.boardId }); }} onMove={(bookmark) => { setSearchOpen(false); setMoveIntent({ kind: "bookmark", bookmark }); }} onCopy={copyUrl} onDelete={deleteBookmark} /> : null}
        {editor !== null ? <BookmarkEditor open bookmark={editor.bookmark} privacy={privacy} initialBoardId={editor.boardId || boards[0]?.id || ""} pages={workspace.pages} boards={workspace.boards} onClose={() => setEditor(null)} onSaved={() => notifySuccess(t("bookmark.saved"))} onError={notifyError} /> : null}
      </Suspense>
      {pasteIntent ? <PasteLinksDialog
        workspace={workspace}
        boardId={pasteIntent.boardId}
        initialText={pasteIntent.text}
        privacy={privacy}
        onCreated={pasteCreated}
        onClose={() => {
          const boardId = pasteIntent.boardId;
          setPasteIntent(null);
          queueMicrotask(() => document.querySelector<HTMLElement>(`[data-board-id="${CSS.escape(boardId)}"] .board__title`)?.focus());
        }}
      /> : null}
      <NameDialog open={nameIntent !== null} title={t(nameIntent?.kind === "new-page" ? "name.newPage" : nameIntent?.kind === "rename-page" ? "name.renamePage" : nameIntent?.kind === "new-board" ? "name.newBoard" : "name.renameBoard")} label={t("generic.title")} initialValue={nameIntent && "page" in nameIntent ? nameIntent.page.title : nameIntent && "board" in nameIntent ? nameIntent.board.title : ""} submitLabel={t(nameIntent?.kind.startsWith("new-") ? "generic.create" : "generic.save")} onClose={() => setNameIntent(null)} onSubmit={handleNameSubmit} />
      <MoveDialog
        open={moveIntent !== null}
        privacy={privacy}
        type={moveIntent?.kind === "board" ? "board" : moveIntent?.kind === "bulk" ? "bulk-bookmarks" : "bookmark"}
        pages={workspace.pages}
        boards={workspace.boards}
        currentId={moveIntent?.kind === "board" ? moveIntent.board.pageId : moveIntent?.kind === "bookmark" ? moveIntent.bookmark.boardId : undefined}
        onClose={() => setMoveIntent(null)}
        onMove={async (destinationId) => {
          if (moveIntent?.kind === "board") await moveBoardToIndex(moveIntent.board.id, destinationId, Number.MAX_SAFE_INTEGER);
          if (moveIntent?.kind === "bookmark") await moveBookmarkToIndex(moveIntent.bookmark.id, destinationId, Number.MAX_SAFE_INTEGER);
          if (moveIntent?.kind === "bulk") {
            const validIds = new Set(bookmarks.map((b) => b.id));
            const ids = [...selectedIds].filter((id) => validIds.has(id));
            if (ids.length) await bulkMoveBookmarks(ids, destinationId);
            setSelectedIds(new Set());
          }
        }}
      />
      {openBoardIntent ? (
        <Modal
          open
          size="small"
          title={t("board.openAllConfirmTitle")}
          describedById={openBoardConfirmId}
          onClose={() => setOpenBoardIntent(null)}
          footer={(
            <>
              <Button onClick={() => setOpenBoardIntent(null)}>{t("generic.cancel")}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const intent = openBoardIntent;
                  setOpenBoardIntent(null);
                  void executeOpenBoard(intent.urls, intent.mode, intent.truncated);
                }}
              >
                {t("generic.open")}
              </Button>
            </>
          )}
        >
          <div className="form-stack">
            <p id={openBoardConfirmId} className="modal__confirm-text">{t("board.openAllConfirmBody", { count: openBoardIntent.count })}</p>
          </div>
        </Modal>
      ) : null}
      <Suspense fallback={<div className="overlay-loading" role="status" aria-label={t("loading.opening")} />}>
        {settingsOpen ? <SettingsDialog open initialSection={settingsSection} workspace={workspace} onClose={() => setSettingsOpen(false)} onUpdated={notifySuccess} onError={notifyError} onOpenTrash={() => { setSettingsOpen(false); setTrashOpen(true); }} /> : null}
        {trashOpen ? <TrashDialog open privacy={privacy} onClose={() => setTrashOpen(false)} onChanged={notifySuccess} onError={notifyError} /> : null}
      </Suspense>
      {toasts.region}
    </div>
  );
}
