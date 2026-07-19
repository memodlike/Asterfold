import { useState, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, ExternalLink, GripVertical, Link2, MoreHorizontal, MoveRight, Pencil, Pin, Square, Trash2 } from "lucide-react";
import type { Bookmark, ThemeConfig } from "../../domain/models";
import { faviconUrl } from "../../browser/api";

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

export function BookmarkCard(props: BookmarkCardProps) {
  const sortable = useSortable({ id: `bookmark:${props.bookmark.id}`, data: { type: "bookmark", bookmarkId: props.bookmark.id, boardId: props.bookmark.boardId } });
  const [iconFailed, setIconFailed] = useState(false);
  const source = props.bookmark.customIcon || props.bookmark.faviconUrl || faviconUrl(props.bookmark.url, props.theme.faviconSize);
  const monogram = (props.bookmark.hostname[0] || props.bookmark.title[0] || "?").toUpperCase();
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={`bookmark-card bookmark-card--${props.theme.cardVariant} ${props.selected ? "is-selected" : ""} ${sortable.isDragging ? "is-dragging" : ""}`}
      data-bookmark-id={props.bookmark.id}
    >
      <button className="drag-handle bookmark-card__drag" aria-label={`Move ${props.bookmark.title}`} {...sortable.attributes} {...sortable.listeners}><GripVertical size={15} /></button>
      <button className="bookmark-card__select" aria-label={props.selected ? `Deselect ${props.bookmark.title}` : `Select ${props.bookmark.title}`} onClick={(event) => props.onSelect(props.bookmark, event)}>
        {props.selected ? <Check size={14} /> : <Square size={14} />}
      </button>
      <button className="bookmark-card__open" onClick={() => props.onOpen(props.bookmark)} title={`Open ${props.bookmark.title}`}>
        <span className="favicon" aria-hidden="true">
          {source && !iconFailed ? <img src={source} alt="" onError={() => setIconFailed(true)} /> : <span>{monogram}</span>}
        </span>
        <span className={`bookmark-card__copy ${props.privacy ? "private-content" : ""}`}>
          <strong>{props.bookmark.title}</strong>
          {props.theme.showHostname && props.theme.cardVariant !== "minimal" ? <small>{props.bookmark.hostname}</small> : null}
          {props.theme.showDescription && props.theme.cardVariant !== "minimal" && props.bookmark.description ? <em>{props.bookmark.description}</em> : null}
        </span>
      </button>
      {props.bookmark.pinned ? <Pin className="bookmark-card__pin" size={13} aria-label="Pinned" /> : null}
      <details className="menu bookmark-card__menu">
        <summary aria-label={`Actions for ${props.bookmark.title}`}><MoreHorizontal size={17} /></summary>
        <div className="menu__popover menu__popover--right">
          <button onClick={() => props.onOpen(props.bookmark)}><ExternalLink size={15} />Open</button>
          <button onClick={() => props.onEdit(props.bookmark)}><Pencil size={15} />Edit</button>
          <button onClick={() => props.onMove(props.bookmark)}><MoveRight size={15} />Move</button>
          <button disabled={props.privacy} onClick={() => props.onCopyUrl(props.bookmark)}><Link2 size={15} />Copy URL</button>
          <button disabled={props.privacy} onClick={() => props.onCopyMarkdown(props.bookmark)}><Copy size={15} />Copy Markdown</button>
          <button onClick={() => props.onDuplicate(props.bookmark)}><Copy size={15} />Duplicate</button>
          <button className="danger" onClick={() => props.onDelete(props.bookmark)}><Trash2 size={15} />Move to Trash</button>
        </div>
      </details>
    </article>
  );
}
