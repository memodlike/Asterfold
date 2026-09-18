import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, ExternalLink, Link2, MoveRight, Pencil, Trash2 } from "lucide-react";
import { memo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import type { Bookmark } from "../../domain/models";
import { FloatingContextMenu, type ContextMenuPoint } from "../../components/FloatingContextMenu";
import { BrowserFavicon } from "../../components/BrowserFavicon";
import { faviconUrl } from "../../browser/api";
import { useI18n } from "../../i18n";

interface BookmarkCardProps {
  bookmark: Bookmark;
  faviconSize: number;
  privacy: boolean;
  selected: boolean;
  onOpen: (bookmark: Bookmark) => void;
  onEdit: (bookmark: Bookmark) => void;
  onMove: (bookmark: Bookmark) => void;
  onDuplicate: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onCopyUrl: (bookmark: Bookmark) => void;
  onCopyMarkdown: (bookmark: Bookmark) => void;
  onSelect: (bookmark: Bookmark, event: MouseEvent) => void;
}

export const BookmarkCard = memo(function BookmarkCard(props: BookmarkCardProps) {
  const { t } = useI18n();
  const sortable = useSortable({ id: `bookmark:${props.bookmark.id}`, data: { type: "bookmark", bookmarkId: props.bookmark.id, boardId: props.bookmark.boardId } });
  const [menuPoint, setMenuPoint] = useState<ContextMenuPoint | null>(null);
  // Legacy customIcon values remain in backups for lossless compatibility, but
  // are not rendered until they have a bounded decode-and-resize pipeline.
  const source = props.privacy ? "" : faviconUrl(props.bookmark.url, Math.min(18, Math.max(12, props.faviconSize / 2)));
  const displayTitle = props.privacy ? "••••••••" : props.bookmark.title;
  const openLabel = props.privacy ? t("privacy.openHiddenBookmark") : t("bookmark.open", { name: props.bookmark.title });
  const menuLabel = props.privacy ? t("privacy.hiddenBookmarkActions") : t("bookmark.actions", { name: props.bookmark.title });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition } as CSSProperties;

  const openContext = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPoint({ x: event.clientX, y: event.clientY });
  };
  const openKeyboardContext = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPoint({ x: rect.right, y: rect.bottom });
  };
  const action = (callback: () => void): void => {
    callback();
    setMenuPoint(null);
  };

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={`bookmark-card ${props.selected ? "is-selected" : ""} ${sortable.isDragging ? "is-dragging" : ""}`}
      data-bookmark-id={props.bookmark.id}
      onContextMenu={openContext}
    >
      <button
        className="bookmark-card__open"
        title={openLabel}
        aria-label={openLabel}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) props.onSelect(props.bookmark, event);
          else props.onOpen(props.bookmark);
        }}
        onKeyDown={(event) => { if (event.shiftKey && event.key === "F10") openKeyboardContext(event); }}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <span className="bookmark-card__surface">
          <BrowserFavicon key={source} source={source} privacy={props.privacy} />
          <strong className={props.privacy ? "private-content private-placeholder" : ""}>{displayTitle}</strong>
        </span>
      </button>
      {menuPoint ? <FloatingContextMenu label={menuLabel} point={menuPoint} onClose={() => setMenuPoint(null)}>
        <button onClick={() => action(() => props.onOpen(props.bookmark))}><ExternalLink size={15} />{t("bookmark.open", { name: "" }).trim()}</button>
        <button onClick={() => action(() => props.onEdit(props.bookmark))}><Pencil size={15} />{t("bookmark.edit")}</button>
        <button onClick={() => action(() => props.onMove(props.bookmark))}><MoveRight size={15} />{t("generic.move")}</button>
        <button disabled={props.privacy} onClick={() => action(() => props.onCopyUrl(props.bookmark))}><Link2 size={15} />{t("bookmark.copyUrl")}</button>
        <button disabled={props.privacy} onClick={() => action(() => props.onCopyMarkdown(props.bookmark))}><Copy size={15} />{t("bookmark.copyMarkdown")}</button>
        <button onClick={() => action(() => props.onDuplicate(props.bookmark))}><Copy size={15} />{t("generic.duplicate")}</button>
        <button className="danger" onClick={() => action(() => props.onDelete(props.bookmark))}><Trash2 size={15} />{t("bookmark.moveTrash")}</button>
      </FloatingContextMenu> : null}
    </article>
  );
});
