import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { ArchiveRestore, Bookmark, FileStack, LayoutPanelTop, Trash2 } from "lucide-react";
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
  privacy?: boolean;
}

export function TrashDialog(props: TrashDialogProps) {
  const { locale, t } = useI18n();
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const trash = useLiveQuery(() => listTrash(db), [props.open], { pages: [], boards: [], bookmarks: [] });
  const [filter, setFilter] = useState<"all" | "page" | "board" | "bookmark">("all");
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const pendingKeysRef = useRef(new Set<string>());
  const items = [
    ...(trash?.pages ?? []).map((item) => ({ type: "page" as const, id: item.id, title: item.title, deletedAt: item.deletedAt })),
    ...(trash?.boards ?? []).map((item) => ({ type: "board" as const, id: item.id, title: item.title, deletedAt: item.deletedAt })),
    ...(trash?.bookmarks ?? []).map((item) => ({ type: "bookmark" as const, id: item.id, title: item.title, deletedAt: item.deletedAt })),
  ].filter((item) => filter === "all" || item.type === filter).sort((left, right) => (right.deletedAt ?? "").localeCompare(left.deletedAt ?? ""));
  const totalItems = (trash?.pages.length ?? 0) + (trash?.boards.length ?? 0) + (trash?.bookmarks.length ?? 0);
  const typeMeta = (type: typeof items[number]["type"]) => type === "page"
    ? { icon: <FileStack size={15} />, label: t("trash.pages") }
    : type === "board"
      ? { icon: <LayoutPanelTop size={15} />, label: t("trash.boards") }
      : { icon: <Bookmark size={15} />, label: t("trash.bookmarks") };
  const runOnce = async (key: string, action: () => Promise<void>): Promise<void> => {
    if (pendingKeysRef.current.has(key)) return;
    pendingKeysRef.current.add(key);
    setPendingKeys(new Set(pendingKeysRef.current));
    try {
      await action();
    } finally {
      pendingKeysRef.current.delete(key);
      setPendingKeys(new Set(pendingKeysRef.current));
    }
  };
  const restore = async (type: typeof items[number]["type"], id: string): Promise<void> => {
    const key = `${type}:${id}`;
    await runOnce(key, async () => {
      try {
        if (type === "page") await restorePage(id);
        else if (type === "board") await restoreBoard(id);
        else await restoreBookmark(id);
        props.onChanged(t("trash.restored"));
      } catch { props.onError(t("error.restoreFailed")); }
    });
  };
  const remove = async (type: typeof items[number]["type"], id: string): Promise<void> => {
    const key = `${type}:${id}`;
    if (pendingKeysRef.current.has(key)) return;
    if (!window.confirm(t("trash.confirmItem"))) return;
    await runOnce(key, async () => {
      try { await permanentlyDelete(type, id); props.onChanged(t("trash.deleted")); } catch { props.onError(t("error.deletePermanentFailed")); }
    });
  };
  const removeAll = async (): Promise<void> => {
    if (pendingKeysRef.current.size > 0 || !window.confirm(t("trash.permanent"))) return;
    await runOnce("empty", async () => {
      try {
        const count = await emptyTrash();
        props.onChanged(t("trash.items", { count }));
      } catch {
        props.onError(t("error.emptyTrashFailed"));
      }
    });
  };
  return (
    <Modal open={props.open} size="large" className="modal--trash" title={t("trash.title")} description={t("trash.description")} onClose={props.onClose} footer={totalItems > 0 ? <Button variant="danger" icon={<Trash2 size={15} />} disabled={pendingKeys.size > 0} onClick={() => void removeAll()}>{t("trash.emptyAction")}</Button> : undefined}>
      <div className="trash-dialog">
        <div className="trash-toolbar">
          <div className="segmented" role="group" aria-label={t("trash.title")}>{(["all", "page", "board", "bookmark"] as const).map((item) => <button aria-pressed={filter === item} className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)}>{item === "all" ? <Trash2 size={14} /> : typeMeta(item).icon}<span>{t(item === "all" ? "trash.all" : item === "page" ? "trash.pages" : item === "board" ? "trash.boards" : "trash.bookmarks")}</span></button>)}</div>
          <span className="trash-toolbar__count">{t("trash.items", { count: items.length })}</span>
        </div>
        {items.length === 0 ? <div className="trash-empty"><span className="trash-empty__icon"><Trash2 size={24} /></span><div><strong>{t("trash.empty")}</strong><p>{t("trash.emptyBody")}</p></div></div> : (
          <div className="trash-list">{items.map((item) => {
            const meta = typeMeta(item.type);
            const pending = pendingKeys.has(`${item.type}:${item.id}`);
            return <article className="trash-row" key={`${item.type}:${item.id}`}>
              <span className="trash-row__icon" aria-hidden="true">{meta.icon}</span>
              <div className="trash-row__content"><strong>{props.privacy ? t("privacy.hiddenBookmark") : item.title}</strong><span>{meta.label}{item.deletedAt ? ` · ${dateTime.format(new Date(item.deletedAt))}` : ""}</span></div>
              <div className="trash-row__actions"><Button size="small" icon={<ArchiveRestore size={14} />} disabled={pending} onClick={() => void restore(item.type, item.id)}>{t("trash.restore")}</Button><Button size="small" variant="ghost" aria-label={t("generic.delete")} icon={<Trash2 size={14} />} disabled={pending} onClick={() => void remove(item.type, item.id)} /></div>
            </article>;
          })}</div>
        )}
      </div>
    </Modal>
  );
}
