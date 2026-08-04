import { useEffect, useMemo, useState } from "react";
import type { Board, Page } from "../domain/models";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { SelectField, type SelectOption } from "./SelectField";
import { useI18n } from "../i18n";

interface MoveDialogProps {
  open: boolean;
  type: "bookmark" | "board" | "bulk-bookmarks";
  pages: Page[];
  boards: Board[];
  currentId?: string | undefined;
  onClose: () => void;
  onMove: (destinationId: string) => void | Promise<void>;
}

export function MoveDialog(props: MoveDialogProps) {
  const { t } = useI18n();
  const options = useMemo<ReadonlyArray<SelectOption>>(() => props.type === "board"
    ? props.pages.filter((page) => page.id !== props.currentId).map((page) => ({ value: page.id, label: page.title }))
    : props.pages.flatMap((page) => props.boards
      .filter((board) => board.pageId === page.id && board.id !== props.currentId)
      .map((board) => ({ value: board.id, label: board.title, group: page.title }))), [props.boards, props.currentId, props.pages, props.type]);
  const firstDestinationId = options[0]?.value ?? "";
  const [destination, setDestination] = useState(firstDestinationId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { if (props.open) { setDestination(firstDestinationId); setError(false); } }, [props.open, firstDestinationId]);
  const move = async (): Promise<void> => {
    if (!destination) return;
    setBusy(true);
    setError(false);
    try {
      await props.onMove(destination);
      props.onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={props.open} size="small" title={t(props.type === "board" ? "move.board" : "move.bookmarks")} onClose={props.onClose} footer={<><Button onClick={props.onClose}>{t("generic.cancel")}</Button><Button variant="primary" disabled={!destination || busy} onClick={() => void move()}>{t("generic.move")}</Button></>}>
      <div className="form-stack"><label>{t("generic.destination")}<SelectField autoFocus value={destination} options={options} label={t("generic.destination")} onChange={setDestination} /></label>{error ? <p className="inline-error" role="alert">{t("error.actionFailed")}</p> : null}</div>
    </Modal>
  );
}
