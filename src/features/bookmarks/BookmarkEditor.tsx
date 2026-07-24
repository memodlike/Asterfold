import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bookmark as BookmarkIcon, ExternalLink } from "lucide-react";
import type { Board, Bookmark, BookmarkOpenMode, Page } from "../../domain/models";
import { createBookmark, findDuplicate, updateBookmark } from "../../db/repository";
import { DuplicateError } from "../../domain/errors";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { faviconUrl } from "../../browser/api";
import { useI18n } from "../../i18n";

interface BookmarkEditorProps {
  open: boolean;
  bookmark: Bookmark | null;
  initialBoardId: string;
  initialUrl?: string;
  initialTitle?: string;
  initialDescription?: string;
  pages: Page[];
  boards: Board[];
  onClose: () => void;
  onSaved: (bookmark: Bookmark) => void;
  onError: (message: string) => void;
}

export function BookmarkEditor(props: BookmarkEditorProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [boardId, setBoardId] = useState("");
  const [openMode, setOpenMode] = useState<BookmarkOpenMode>("current");
  const [pinned, setPinned] = useState(false);
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setTitle(props.bookmark?.title ?? props.initialTitle ?? "");
    setUrl(props.bookmark?.url ?? props.initialUrl ?? "https://");
    setDescription(props.bookmark?.description ?? props.initialDescription ?? "");
    setBoardId(props.bookmark?.boardId ?? props.initialBoardId);
    setOpenMode(props.bookmark?.openMode ?? "current");
    setPinned(props.bookmark?.pinned ?? false);
    setAllowDuplicate(false);
    setDuplicate(null);
  }, [props.bookmark, props.initialBoardId, props.initialDescription, props.initialTitle, props.initialUrl, props.open]);

  useEffect(() => {
    if (!props.open || !boardId || !url.startsWith("http")) {
      setDuplicate(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void findDuplicate(boardId, url, undefined, props.bookmark?.id).then((match) => { if (active) setDuplicate(match); }).catch(() => { if (active) setDuplicate(null); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [boardId, props.bookmark?.id, props.open, url]);

  const boardOptions = useMemo(() => props.pages.map((page) => ({ page, boards: props.boards.filter((board) => board.pageId === page.id) })), [props.boards, props.pages]);
  const icon = url.startsWith("http") ? faviconUrl(url, 48) : "";

  const save = async (): Promise<void> => {
    setSaving(true);
    performance.mark("asterfold-save-start");
    try {
      const saved = props.bookmark
        ? await updateBookmark(props.bookmark.id, { title, url, description, boardId, openMode, pinned })
        : await createBookmark({ boardId, title, url, description, openMode, pinned }, { allowDuplicate });
      performance.mark("asterfold-save-committed");
      performance.measure("asterfold-local-save", "asterfold-save-start", "asterfold-save-committed");
      props.onSaved(saved);
      props.onClose();
    } catch (error) {
      if (error instanceof DuplicateError) {
        setDuplicate(await findDuplicate(boardId, url));
      } else {
        props.onError(t("error.saveBookmarkFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={props.open}
      side
      size="small"
      title={t(props.bookmark ? "bookmark.editTitle" : "bookmark.add")}
      description={t(props.bookmark ? "bookmark.editDescription" : "bookmark.addDescription")}
      onClose={props.onClose}
      footer={<><Button onClick={props.onClose}>{t("generic.cancel")}</Button><Button variant="primary" disabled={saving || !boardId} onClick={() => void save()}>{saving ? t("popup.saving") : t("generic.save")}</Button></>}
    >
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="bookmark-preview">
          <span className="favicon favicon--large">{icon ? <img src={icon} alt="" /> : <BookmarkIcon size={22} />}</span>
          <div><strong>{title || t("bookmark.untitled")}</strong><small>{url}</small></div>
        </div>
        <label>{t("generic.title")}<input autoFocus value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} placeholder={t("bookmark.untitled")} /></label>
        <label>{t("bookmark.url")}<input type="url" required value={url} maxLength={8192} onChange={(event) => setUrl(event.target.value)} placeholder={t("bookmark.urlPlaceholder")} /></label>
        <label>{t("generic.description")}<textarea value={description} maxLength={2000} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder={t("bookmark.optionalNote")} /></label>
        <label>{t("generic.destination")}<select required value={boardId} onChange={(event) => setBoardId(event.target.value)}>
          {boardOptions.map(({ page, boards }) => (
            <optgroup key={page.id} label={page.title}>{boards.map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</optgroup>
          ))}
        </select></label>
        <label>{t("bookmark.openMode")}<select value={openMode} onChange={(event) => setOpenMode(event.target.value as BookmarkOpenMode)}>
          <option value="current">{t("bookmark.currentTab")}</option><option value="new-tab">{t("bookmark.newTab")}</option><option value="new-window">{t("bookmark.newWindow")}</option><option value="incognito">{t("bookmark.incognito")}</option>
        </select></label>
        {duplicate ? (
          <div className="inline-warning"><AlertTriangle size={18} /><div><strong>{t("bookmark.duplicateWarning")}</strong><span>{duplicate.title}</span>{!props.bookmark ? <button type="button" onClick={() => setAllowDuplicate(true)}>{t(allowDuplicate ? "bookmark.copyWillSave" : "bookmark.saveCopy")}</button> : null}</div><ExternalLink size={15} /></div>
        ) : null}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
