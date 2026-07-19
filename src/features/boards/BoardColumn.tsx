import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Copy, GripHorizontal, LayoutGrid, List, MoreHorizontal, MoveRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import type { Board, Bookmark, ThemeConfig } from "../../domain/models";
import { BookmarkCard } from "../bookmarks/BookmarkCard";

interface BoardColumnProps {
  board: Board;
  bookmarks: Bookmark[];
  privacy: boolean;
  selectedIds: Set<string>;
  theme: ThemeConfig;
  onAddBookmark: (board: Board) => void;
  onEditBoard: (board: Board) => void;
  onMoveBoard: (board: Board) => void;
  onDuplicateBoard: (board: Board) => void;
  onDeleteBoard: (board: Board) => void;
  onToggleBoard: (board: Board) => void;
  onToggleLayout: (board: Board) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onMoveBookmark: (bookmark: Bookmark) => void;
  onDuplicateBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
  onCopyUrl: (bookmark: Bookmark) => void;
  onCopyMarkdown: (bookmark: Bookmark) => void;
  onSelectBookmark: (bookmark: Bookmark, event: MouseEvent) => void;
}

export function BoardColumn(props: BoardColumnProps) {
  const sortable = useSortable({ id: `board:${props.board.id}`, data: { type: "board", boardId: props.board.id } });
  const drop = useDroppable({ id: `board-drop:${props.board.id}`, data: { type: "board-drop", boardId: props.board.id } });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  const setRefs = (node: HTMLDivElement | null): void => {
    sortable.setNodeRef(node);
    drop.setNodeRef(node);
  };
  return (
    <section ref={setRefs} style={style} className={`board ${drop.isOver ? "is-over" : ""} ${sortable.isDragging ? "is-dragging" : ""}`} data-board-id={props.board.id}>
      <header className="board__header">
        <button className="drag-handle board__drag" aria-label={`Reorder ${props.board.title}`} {...sortable.attributes} {...sortable.listeners}><GripHorizontal size={17} /></button>
        <button className="board__title" onClick={() => props.onToggleBoard(props.board)}>
          {props.board.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          <strong>{props.board.title}</strong><span>{props.bookmarks.length}</span>
        </button>
        <button className="board__add" onClick={() => props.onAddBookmark(props.board)} aria-label={`Add bookmark to ${props.board.title}`}><Plus size={18} /></button>
        <details className="menu">
          <summary aria-label={`Actions for ${props.board.title}`}><MoreHorizontal size={17} /></summary>
          <div className="menu__popover menu__popover--right">
            <button onClick={() => props.onEditBoard(props.board)}><Pencil size={15} />Rename</button>
            <button onClick={() => props.onToggleLayout(props.board)}>{props.board.layout === "list" ? <LayoutGrid size={15} /> : <List size={15} />}Switch layout</button>
            <button onClick={() => props.onMoveBoard(props.board)}><MoveRight size={15} />Move to Page</button>
            <button onClick={() => props.onDuplicateBoard(props.board)}><Copy size={15} />Duplicate</button>
            <button className="danger" onClick={() => props.onDeleteBoard(props.board)}><Trash2 size={15} />Move to Trash</button>
          </div>
        </details>
      </header>
      {!props.board.collapsed ? (
        <div className={`board__items board__items--${props.board.layout}`}>
          <SortableContext items={props.bookmarks.map((bookmark) => `bookmark:${bookmark.id}`)} strategy={verticalListSortingStrategy}>
            {props.bookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                privacy={props.privacy}
                selected={props.selectedIds.has(bookmark.id)}
                theme={props.theme}
                onOpen={props.onOpenBookmark}
                onEdit={props.onEditBookmark}
                onMove={props.onMoveBookmark}
                onDuplicate={props.onDuplicateBookmark}
                onDelete={props.onDeleteBookmark}
                onCopyUrl={props.onCopyUrl}
                onCopyMarkdown={props.onCopyMarkdown}
                onSelect={props.onSelectBookmark}
              />
            ))}
          </SortableContext>
          {props.bookmarks.length === 0 ? <div className="board__empty">Drop a link here or add one</div> : null}
        </div>
      ) : null}
      {!props.board.collapsed ? <button className="board__footer" onClick={() => props.onAddBookmark(props.board)}><Plus size={16} />Add bookmark</button> : null}
    </section>
  );
}
