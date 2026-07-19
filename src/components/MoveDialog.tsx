import { useEffect, useState } from "react";
import type { Board, Page } from "../domain/models";
import { Button } from "./Button";
import { Modal } from "./Modal";

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
  const destinations = props.type === "board" ? props.pages : props.boards;
  const available = destinations.filter((item) => item.id !== props.currentId);
  const firstDestinationId = available[0]?.id ?? "";
  const [destination, setDestination] = useState(firstDestinationId);
  useEffect(() => { if (props.open) setDestination(firstDestinationId); }, [props.open, firstDestinationId]);
  return (
    <Modal open={props.open} size="small" title={props.type === "board" ? "Move board" : "Move bookmarks"} onClose={props.onClose} footer={<><Button onClick={props.onClose}>Cancel</Button><Button variant="primary" disabled={!destination} onClick={() => { void Promise.resolve(props.onMove(destination)).then(props.onClose); }}>Move</Button></>}>
      <div className="form-stack"><label>Destination<select autoFocus value={destination} onChange={(event) => setDestination(event.target.value)}>
        {props.type === "board"
          ? props.pages.filter((page) => page.id !== props.currentId).map((page) => <option key={page.id} value={page.id}>{page.title}</option>)
          : props.pages.map((page) => <optgroup key={page.id} label={page.title}>{props.boards.filter((board) => board.pageId === page.id && board.id !== props.currentId).map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</optgroup>)}
      </select></label></div>
    </Modal>
  );
}
