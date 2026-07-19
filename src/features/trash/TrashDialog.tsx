import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { db } from "../../db/database";
import { emptyTrash, listTrash, permanentlyDelete, restoreBoard, restoreBookmark, restorePage } from "../../db/repository";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";

interface TrashDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}

export function TrashDialog(props: TrashDialogProps) {
  const trash = useLiveQuery(() => listTrash(db), [props.open], { pages: [], boards: [], bookmarks: [] });
  const [filter, setFilter] = useState<"all" | "page" | "board" | "bookmark">("all");
  const items = [
    ...(trash?.pages ?? []).map((item) => ({ type: "page" as const, id: item.id, title: item.title, deletedAt: item.deletedAt })),
    ...(trash?.boards ?? []).map((item) => ({ type: "board" as const, id: item.id, title: item.title, deletedAt: item.deletedAt })),
    ...(trash?.bookmarks ?? []).map((item) => ({ type: "bookmark" as const, id: item.id, title: item.title, deletedAt: item.deletedAt })),
  ].filter((item) => filter === "all" || item.type === filter).sort((left, right) => (right.deletedAt ?? "").localeCompare(left.deletedAt ?? ""));
  const restore = async (type: typeof items[number]["type"], id: string): Promise<void> => {
    try {
      if (type === "page") await restorePage(id);
      else if (type === "board") await restoreBoard(id);
      else await restoreBookmark(id);
      props.onChanged("Restored from Trash");
    } catch (error) { props.onError(error instanceof Error ? error.message : "Restore failed"); }
  };
  const remove = async (type: typeof items[number]["type"], id: string): Promise<void> => {
    if (!window.confirm("Permanently delete this item? This cannot be undone from Trash.")) return;
    try { await permanentlyDelete(type, id); props.onChanged("Permanently deleted"); } catch (error) { props.onError(error instanceof Error ? error.message : "Delete failed"); }
  };
  return (
    <Modal open={props.open} size="large" title="Trash" description="Deleted items stay recoverable until retention cleanup." onClose={props.onClose} footer={<Button variant="danger" disabled={items.length === 0} onClick={() => { if (window.confirm("Empty Trash permanently? A local safety snapshot will be created first.")) void emptyTrash().then((count) => props.onChanged(`${count} items permanently deleted`)).catch((error: unknown) => props.onError(error instanceof Error ? error.message : "Unable to empty Trash")); }}>Empty Trash</Button>}>
      <div className="trash-toolbar"><div className="segmented">{(["all", "page", "board", "bookmark"] as const).map((item) => <button className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)}>{item === "all" ? "All" : `${item}s`}</button>)}</div><span>{items.length} items</span></div>
      {items.length === 0 ? <div className="empty-inline"><Trash2 size={26} /><strong>Trash is empty</strong><span>Deleted Pages, Boards, and Bookmarks will appear here.</span></div> : (
        <div className="trash-list">{items.map((item) => <div className="trash-row" key={`${item.type}:${item.id}`}><span className="trash-row__type">{item.type}</span><strong>{item.title}</strong><time>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : ""}</time><Button size="small" icon={<ArchiveRestore size={14} />} onClick={() => void restore(item.type, item.id)}>Restore</Button><Button size="small" variant="ghost" icon={<Trash2 size={14} />} onClick={() => void remove(item.type, item.id)}>Delete</Button></div>)}</div>
      )}
    </Modal>
  );
}
