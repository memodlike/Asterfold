import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bookmark as BookmarkIcon, ExternalLink } from "lucide-react";
import type { Board, Bookmark, BookmarkOpenMode, Page } from "../../domain/models";
import { createBookmark, findDuplicate, updateBookmark } from "../../db/repository";
import { DuplicateError } from "../../domain/errors";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { faviconUrl } from "../../browser/api";

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
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [boardId, setBoardId] = useState("");
  const [openMode, setOpenMode] = useState<BookmarkOpenMode>("new-tab");
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
    setOpenMode(props.bookmark?.openMode ?? "new-tab");
    setPinned(props.bookmark?.pinned ?? false);
    setAllowDuplicate(false);
    setDuplicate(null);
  }, [props.bookmark, props.initialBoardId, props.initialDescription, props.initialTitle, props.initialUrl, props.open]);

  useEffect(() => {
    if (!props.open || props.bookmark || !boardId || !url.startsWith("http")) {
      setDuplicate(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void findDuplicate(boardId, url).then((match) => { if (active) setDuplicate(match); }).catch(() => { if (active) setDuplicate(null); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [boardId, props.bookmark, props.open, url]);

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
        props.onError(error instanceof Error ? error.message : "Unable to save bookmark");
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
      title={props.bookmark ? "Edit bookmark" : "Add bookmark"}
      description={props.bookmark ? "Update the link and where it belongs." : "Save a link directly into this workspace."}
      onClose={props.onClose}
      footer={<><Button onClick={props.onClose}>Cancel</Button><Button variant="primary" disabled={saving || !boardId} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button></>}
    >
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="bookmark-preview">
          <span className="favicon favicon--large">{icon ? <img src={icon} alt="" /> : <BookmarkIcon size={22} />}</span>
          <div><strong>{title || "Untitled bookmark"}</strong><small>{url}</small></div>
        </div>
        <label>Title<input autoFocus value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} placeholder="Bookmark title" /></label>
        <label>URL<input type="url" required value={url} maxLength={8192} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" /></label>
        <label>Description<textarea value={description} maxLength={2000} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="Optional note or context" /></label>
        <label>Destination<select required value={boardId} onChange={(event) => setBoardId(event.target.value)}>
          {boardOptions.map(({ page, boards }) => (
            <optgroup key={page.id} label={page.title}>{boards.map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</optgroup>
          ))}
        </select></label>
        <label>Open mode<select value={openMode} onChange={(event) => setOpenMode(event.target.value as BookmarkOpenMode)}>
          <option value="current">Current tab</option><option value="new-tab">New tab</option><option value="new-window">New window</option><option value="incognito">Incognito window</option>
        </select></label>
        <label className="checkbox-row"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />Pin this bookmark</label>
        {duplicate ? (
          <div className="inline-warning"><AlertTriangle size={18} /><div><strong>Already saved in this board</strong><span>{duplicate.title}</span>{!props.bookmark ? <button type="button" onClick={() => setAllowDuplicate(true)}>{allowDuplicate ? "A duplicate will be created" : "Save another copy anyway"}</button> : null}</div><ExternalLink size={15} /></div>
        ) : null}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
