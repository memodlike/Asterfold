import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { db } from "../../db/database";
import { emptyTrash, listTrash, permanentlyDelete, restoreBoard, restoreBookmark, restorePage } from "../../db/repository";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { useI18n } from "../../i18n";

interface TrashDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}

export function TrashDialog(props: TrashDialogProps) {
  const { t } = useI18n();
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
      props.onChanged(t("trash.restored"));
    } catch (error) { props.onError(error instanceof Error ? error.message : "Restore failed"); }
  };
  const remove = async (type: typeof items[number]["type"], id: string): Promise<void> => {
    if (!window.confirm("Permanently delete this item? This cannot be undone from Trash.")) return;
    try { await permanentlyDelete(type, id); props.onChanged("Permanently deleted"); } catch (error) { props.onError(error instanceof Error ? error.message : "Delete failed"); }
  };
  return (
    <Modal open={props.open} size="large" title={t("trash.title")} description={t("trash.description")} onClose={props.onClose} footer={<Button variant="danger" disabled={items.length === 0} onClick={() => { if (window.confirm(t("trash.permanent"))) void emptyTrash().then((count) => props.onChanged(t("trash.items", { count }))).catch((error: unknown) => props.onError(error instanceof Error ? error.message : "Unable to empty Trash")); }}>{t("trash.emptyAction")}</Button>}>
      <div className="trash-toolbar"><div className="segmented">{(["all", "page", "board", "bookmark"] as const).map((item) => <button className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)}>{t(item === "all" ? "trash.all" : item === "page" ? "trash.pages" : item === "board" ? "trash.boards" : "trash.bookmarks")}</button>)}</div><span>{t("trash.items", { count: items.length })}</span></div>
      {items.length === 0 ? <div className="empty-inline"><Trash2 size={26} /><strong>{t("trash.empty")}</strong><span>{t("trash.emptyBody")}</span></div> : (
        <div className="trash-list">{items.map((item) => <div className="trash-row" key={`${item.type}:${item.id}`}><span className="trash-row__type">{item.type}</span><strong>{item.title}</strong><time>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : ""}</time><Button size="small" icon={<ArchiveRestore size={14} />} onClick={() => void restore(item.type, item.id)}>{t("trash.restore")}</Button><Button size="small" variant="ghost" icon={<Trash2 size={14} />} onClick={() => void remove(item.type, item.id)}>{t("generic.delete")}</Button></div>)}</div>
      )}
    </Modal>
  );
}
