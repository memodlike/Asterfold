import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { AlertTriangle, Check, ExternalLink, FolderPlus, Settings, Sparkles } from "lucide-react";
import { createBoard, createBookmark, findDuplicate, updateSettings } from "../../src/db/repository";
import type { Bookmark } from "../../src/domain/models";
import { isValidQuickSaveDestination, resolvePageBoardSelection, resolveQuickSaveDestination } from "../../src/domain/quickSave";
import { DuplicateError } from "../../src/domain/errors";
import { faviconUrl, openWorkspace } from "../../src/browser/api";
import { Logo } from "../../src/components/Logo";
import { useWorkspace } from "../../src/app/useWorkspace";
import { translate, type MessageKey } from "../../src/i18n";
import { primaryShortcut } from "../../src/browser/platform";
import { usePrivacyMode } from "../../src/app/usePrivacyMode";

interface ActiveTabData {
  title: string;
  url: string;
}

export function PopupApp() {
  const { workspace, failed, retry } = useWorkspace();
  const t = useCallback((key: MessageKey): string => translate(workspace?.settings.locale ?? "auto", key), [workspace?.settings.locale]);
  const [tab, setTab] = useState<ActiveTabData | null>(null);
  const [pageId, setPageId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState("");
  const { privacy } = usePrivacyMode(workspace?.settings ?? { privacyPersist: false, privacyEnabled: false });

  useEffect(() => {
    void Promise.all([
      browser.tabs.query({ active: true, currentWindow: true }),
      browser.commands.getAll(),
    ]).then(([tabs, commands]) => {
      const active = tabs[0];
      const url = active?.url ?? "";
      const titleValue = active?.title?.trim() || (url ? new URL(url).hostname : t("popup.untitledPage"));
      setTab({ title: titleValue, url });
      setTitle(titleValue);
      setShortcut(commands.find((command) => command.name === "quick-save")?.shortcut ?? "");
    }).catch(() => setError(t("popup.activeTabUnavailable")));
  }, [t]);

  useEffect(() => {
    if (!workspace || pageId) return;
    const destination = resolveQuickSaveDestination(workspace.settings, workspace.pages, workspace.boards, "last");
    setPageId(destination?.pageId ?? "");
    setBoardId(destination?.boardId ?? "");
  }, [pageId, workspace]);

  useEffect(() => {
    if (workspace && tab && performance.getEntriesByName("asterfold-popup-interactive").length === 0) {
      performance.mark("asterfold-popup-interactive");
    }
  }, [tab, workspace]);

  const pageBoards = useMemo(() => workspace?.boards.filter((board) => board.pageId === pageId) ?? [], [pageId, workspace?.boards]);
  const destinationIsValid = workspace ? isValidQuickSaveDestination(pageId, boardId, workspace.boards) : false;
  useEffect(() => {
    const nextBoardId = resolvePageBoardSelection(pageId, boardId, pageBoards);
    if (nextBoardId !== boardId) setBoardId(nextBoardId);
    setDuplicate(null);
    setAllowDuplicate(false);
    setStatus(null);
    setError(null);
  }, [boardId, pageId, pageBoards]);

  useEffect(() => {
    if (!tab?.url || !destinationIsValid) return;
    let active = true;
    const timer = window.setTimeout(() => { void findDuplicate(boardId, tab.url).then((match) => { if (active) setDuplicate(match); }).catch(() => { if (active) setDuplicate(null); }); }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [boardId, destinationIsValid, tab?.url]);

  const save = async (): Promise<void> => {
    if (!tab?.url) return;
    if (!workspace || !isValidQuickSaveDestination(pageId, boardId, workspace.boards)) {
      setError(t("popup.boardRequired"));
      return;
    }
    setSaving(true); setError(null);
    try {
      await createBookmark({ boardId, title, url: tab.url, description }, { allowDuplicate });
      await updateSettings({ quickSaveLastPageId: pageId, quickSaveLastBoardId: boardId });
      setStatus(t("popup.saved"));
      await browser.runtime.sendMessage({ type: "SET_BADGE", status: "saved" });
    } catch (caught) {
      if (caught instanceof DuplicateError) setDuplicate(await findDuplicate(boardId, tab.url));
      else setError(t("popup.saveFailed"));
    } finally { setSaving(false); }
  };

  const addBoard = async (): Promise<void> => {
    if (!newBoardName.trim() || !pageId) return;
    try {
      const board = await createBoard(pageId, newBoardName);
      setBoardId(board.id); setNewBoardName(""); setShowNewBoard(false); setError(null); setStatus(null);
    } catch { setError(t("popup.createBoardFailed")); }
  };

  if (failed) return <div className="popup-loading"><AlertTriangle size={20} />{t("error.actionFailed")}<button onClick={retry}>{t("generic.retry")}</button></div>;
  if (!workspace || !tab) return <div className="popup-loading"><Sparkles size={20} />{t("popup.preparing")}</div>;
  const unsupported = !/^https?:\/\//i.test(tab.url) && !/^mailto:/i.test(tab.url);
  const visibleTitle = privacy ? t("privacy.hiddenBookmark") : tab.title;
  const saveShortcut = primaryShortcut("Enter");
  return (
    <main className="popup" aria-keyshortcuts={saveShortcut.aria} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void save(); } }}>
      <header className="popup__header"><Logo /><button title={t("generic.settings")} aria-label={t("generic.settings")} onClick={() => void openWorkspace()}><Settings size={17} /></button></header>
      <section className="popup__content">
        <div className="popup__title"><h1>{t("popup.title")}</h1>{shortcut ? <kbd>{shortcut}</kbd> : null}</div>
        <div className="tab-preview"><span className="tab-preview__icon">{privacy ? "•" : faviconUrl(tab.url, 40) ? <img src={faviconUrl(tab.url, 40)} alt="" /> : tab.title[0]?.toUpperCase()}</span><div><strong>{visibleTitle}</strong><small>{privacy ? "••••••" : tab.url}</small></div></div>
        {unsupported ? <div className="popup-error"><AlertTriangle size={17} />{t("popup.unsupported")}</div> : null}
        <div className="popup-grid"><label>{t("generic.page")}<select value={pageId} onChange={(event) => setPageId(event.target.value)}>{workspace.pages.map((page, index) => <option key={page.id} value={page.id}>{privacy ? `${t("generic.page")} ${index + 1}` : page.title}</option>)}</select></label><label>{t("generic.board")}<select value={boardId} onChange={(event) => setBoardId(event.target.value)}>{pageBoards.map((board, index) => <option key={board.id} value={board.id}>{privacy ? `${t("generic.board")} ${index + 1}` : board.title}</option>)}</select></label></div>
        {!destinationIsValid ? <div className="popup-error"><AlertTriangle size={17} />{t("popup.boardRequired")}</div> : null}
        {showNewBoard ? <div className="new-board"><input autoFocus value={newBoardName} maxLength={240} placeholder={t("popup.boardName")} onChange={(event) => setNewBoardName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addBoard(); } }} /><button onClick={() => void addBoard()}>{t("generic.create")}</button><button onClick={() => setShowNewBoard(false)}>{t("generic.cancel")}</button></div> : <button className="text-action" onClick={() => setShowNewBoard(true)}><FolderPlus size={15} />{t("popup.createBoard")}</button>}
        {!privacy ? <><label>{t("generic.title")}<input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>{t("generic.description")}<textarea rows={3} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder={t("bookmark.optionalNote")} /></label></> : null}
        {duplicate ? <div className="duplicate-warning"><AlertTriangle size={18} /><div><strong>{t("popup.duplicate")}</strong><span>{privacy ? t("privacy.hiddenBookmark") : duplicate.title}</span><button onClick={() => setAllowDuplicate(true)}>{t(allowDuplicate ? "popup.copyReady" : "popup.saveCopy")}</button></div></div> : null}
        {error ? <div className="popup-error"><AlertTriangle size={17} />{error}</div> : null}
        {status ? <div className="popup-success"><Check size={17} />{status}</div> : null}
        <button className="save-button" disabled={saving || unsupported || !destinationIsValid || (!!duplicate && !allowDuplicate)} onClick={() => void save()}>{saving ? t("popup.saving") : t("popup.save")}</button>
        <button className="workspace-button" onClick={() => void openWorkspace(pageId)}><ExternalLink size={16} />{t("popup.openWorkspace")}</button>
      </section>
      <footer><span><kbd>{saveShortcut.visual}</kbd> {t("generic.save")}</span><span>{t("popup.localOnly")}</span></footer>
    </main>
  );
}
