import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, ExternalLink, Link2, MoveRight, Pencil, Trash2 } from "lucide-react";
import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import type { Bookmark, ThemeConfig } from "../../domain/models";
import { faviconUrl } from "../../browser/api";
import { useI18n } from "../../i18n";

interface BookmarkCardProps {
  bookmark: Bookmark;
  privacy: boolean;
  selected: boolean;
  theme: ThemeConfig;
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
  const [iconFailed, setIconFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const source = props.bookmark.customIcon || props.bookmark.faviconUrl || faviconUrl(props.bookmark.url, 20);
  const monogram = (props.bookmark.hostname[0] || props.bookmark.title[0] || "?").toUpperCase();
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition } as CSSProperties;

  useEffect(() => {
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const openContext = (event: MouseEvent | KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(true);
  };
  const action = (callback: () => void): void => {
    callback();
    setMenuOpen(false);
  };

  return (
    <article
      ref={(node) => { rootRef.current = node; sortable.setNodeRef(node); }}
      style={style}
      className={`bookmark-card ${props.selected ? "is-selected" : ""} ${sortable.isDragging ? "is-dragging" : ""}`}
      data-bookmark-id={props.bookmark.id}
      onContextMenu={openContext}
    >
      <button
        className="bookmark-card__open"
        title={t("bookmark.open", { name: props.bookmark.title })}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) props.onSelect(props.bookmark, event);
          else props.onOpen(props.bookmark);
        }}
        onKeyDown={(event) => { if (event.shiftKey && event.key === "F10") openContext(event); }}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <span className="favicon" aria-hidden="true">{source && !iconFailed ? <img src={source} alt="" onError={() => setIconFailed(true)} /> : <span>{monogram}</span>}</span>
        <strong className={props.privacy ? "private-content" : ""}>{props.bookmark.title}</strong>
      </button>
      {menuOpen ? <div className="context-menu bookmark-context" role="menu" aria-label={t("bookmark.actions", { name: props.bookmark.title })}>
        <button onClick={() => action(() => props.onOpen(props.bookmark))}><ExternalLink size={15} />{t("bookmark.open", { name: "" }).trim()}</button>
        <button onClick={() => action(() => props.onEdit(props.bookmark))}><Pencil size={15} />{t("bookmark.edit")}</button>
        <button onClick={() => action(() => props.onMove(props.bookmark))}><MoveRight size={15} />{t("generic.move")}</button>
        <button disabled={props.privacy} onClick={() => action(() => props.onCopyUrl(props.bookmark))}><Link2 size={15} />{t("bookmark.copyUrl")}</button>
        <button disabled={props.privacy} onClick={() => action(() => props.onCopyMarkdown(props.bookmark))}><Copy size={15} />{t("bookmark.copyMarkdown")}</button>
        <button onClick={() => action(() => props.onDuplicate(props.bookmark))}><Copy size={15} />{t("generic.duplicate")}</button>
        <button className="danger" onClick={() => action(() => props.onDelete(props.bookmark))}><Trash2 size={15} />{t("bookmark.moveTrash")}</button>
      </div> : null}
    </article>
  );
});
