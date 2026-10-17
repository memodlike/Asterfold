import { Bookmark as BookmarkIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, Bookmark, WorkspaceData } from "../../domain/models";
import { analyzePastedLinks, MAX_PASTE_TEXT_LENGTH } from "../../domain/pasteLinks";
import { compareRanks } from "../../domain/ordering";
import { createBookmarksBulk } from "../../db/repository";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { SelectField, type SelectOption } from "../../components/SelectField";
import { useI18n } from "../../i18n";

interface PasteLinksDialogProps {
  workspace: WorkspaceData;
  boardId: string;
  initialText: string;
  privacy: boolean;
  onClose: () => void;
  onCreated: (bookmarks: Bookmark[], board: Board) => void;
}

export function PasteLinksDialog({ workspace, boardId: initialBoardId, initialText, privacy, onClose, onCreated }: PasteLinksDialogProps) {
  const { t } = useI18n();
  const [text, setText] = useState(initialText);
  const [boardId, setBoardId] = useState(initialBoardId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const board = workspace.boards.find((item) => item.id === boardId);
  const analysis = useMemo(() => analyzePastedLinks(text, workspace.bookmarks
    .filter((item) => item.boardId === boardId)
    .map((item) => item.normalizedUrl)), [text, workspace.bookmarks, boardId]);
  const options = useMemo<ReadonlyArray<SelectOption>>(() => [...workspace.pages]
    .sort((left, right) => compareRanks(left.position, right.position))
    .flatMap((page) => workspace.boards
      .filter((item) => item.pageId === page.id)
      .sort((left, right) => compareRanks(left.position, right.position))
      .map((item) => ({
        value: item.id,
        label: `${privacy ? t("generic.page") : page.title} › ${privacy ? t("generic.board") : item.title}`,
      }))), [privacy, t, workspace.boards, workspace.pages]);

  const save = async (): Promise<void> => {
    if (privacy || !board || analysis.items.length === 0 || saving) return;
    setSaving(true);
    setError(false);
    try {
      const created = await createBookmarksBulk(board.id, analysis.items);
      onCreated(created, board);
      if (mounted.current) onClose();
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t("paste.title")}
      description={t("paste.hint")}
      size="small"
      onClose={onClose}
      footer={privacy ? <Button onClick={onClose}>{t("generic.close")}</Button> : <>
        <Button onClick={onClose}>{t("generic.cancel")}</Button>
        <Button variant="primary" disabled={!board || saving || analysis.items.length === 0} onClick={() => void save()}>
          {t("paste.add", { count: analysis.items.length })}
        </Button>
      </>}
    >
      {privacy ? (
        <div className="search-state search-private"><span className="search-state__icon"><BookmarkIcon size={22} /></span><div><strong>{t("search.privateTitle")}</strong><span>{t("search.privateBody")}</span></div></div>
      ) : <div className="form-stack">
        <label>{t("paste.text")}<textarea autoFocus maxLength={MAX_PASTE_TEXT_LENGTH} rows={9} value={text} disabled={saving} onChange={(event) => setText(event.target.value)} /></label>
        <p aria-live="polite">{t("paste.counts", { new: analysis.items.length, duplicate: analysis.duplicate, invalid: analysis.invalid })}</p>
        <label>{t("paste.destination")}<SelectField value={boardId} options={options} label={t("paste.destination")} onChange={setBoardId} disabled={saving} /></label>
        {error ? <p className="inline-error" role="alert">{t("paste.failed")}</p> : null}
      </div>}
    </Modal>
  );
}
