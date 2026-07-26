import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, MoveRight, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import type { Board, Bookmark } from "../../domain/models";
import { FloatingContextMenu, type ContextMenuPoint } from "../../components/FloatingContextMenu";
import { useI18n } from "../../i18n";
import { BookmarkCard } from "../bookmarks/BookmarkCard";
import type { BoardPlacement } from "./layout";

interface BoardColumnProps {
  board: Board;
  placement?: BoardPlacement | undefined;
  bookmarks: Bookmark[];
  privacy: boolean;
  selectedIds: Set<string>;
  onAddBookmark: (board: Board) => void;
  onEditBoard: (board: Board) => void;
  onPatchBoard: (board: Board, patch: Partial<Pick<Board, "bookmarkColumns" | "gridSpan">>) => void;
  onMoveBoard: (board: Board) => void;
  onDuplicateBoard: (board: Board) => void;
  onDeleteBoard: (board: Board) => void;
  onKeyboardMoveBoard: (board: Board, delta: -1 | 1) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onMoveBookmark: (bookmark: Bookmark) => void;
  onDuplicateBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
  onCopyUrl: (bookmark: Bookmark) => void;
  onCopyMarkdown: (bookmark: Bookmark) => void;
  onSelectBookmark: (bookmark: Bookmark, event: MouseEvent) => void;
}

export const BoardColumn = memo(function BoardColumn(props: BoardColumnProps) {
  const { t } = useI18n();
  const [menuPoint, setMenuPoint] = useState<ContextMenuPoint | null>(null);
  const sortable = useSortable({ id: `board:${props.board.id}`, data: { type: "board", boardId: props.board.id } });
  const drop = useDroppable({ id: `board-drop:${props.board.id}`, data: { type: "board-drop", boardId: props.board.id } });
  const columns = props.board.bookmarkColumns === "auto" ? ((props.placement?.span ?? 3) >= 4 || props.bookmarks.length >= 12 ? 2 : 1) : props.board.bookmarkColumns;
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    gridColumn: `${props.placement?.column ?? 1} / span ${props.placement?.span ?? 3}`,
    gridRow: `${(props.placement?.row ?? 0) + 1}`,
  } as CSSProperties;
  const setRefs = (node: HTMLElement | null): void => {
    sortable.setNodeRef(node);
  };

  const openContext = (event: MouseEvent): void => {
    event.preventDefault();
    setMenuPoint({ x: event.clientX, y: event.clientY });
  };
  const openKeyboardContext = (event: KeyboardEvent): void => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPoint({ x: rect.right, y: rect.bottom });
  };
  const action = (callback: () => void): void => {
    callback();
    setMenuPoint(null);
  };

  return (
    <section
      ref={setRefs}
      style={style}
      className={`board ${drop.isOver ? "is-over" : ""} ${sortable.isDragging ? "is-dragging" : ""}`}
      data-board-id={props.board.id}
      onContextMenu={openContext}
      onKeyDown={(event) => { if (event.shiftKey && event.key === "F10") openKeyboardContext(event); }}
    >
      <header className="board__header">
        <button
          className="board__title"
          aria-label={t("board.actions", { name: props.board.title })}
          aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
          {...sortable.attributes}
          {...sortable.listeners}
          onKeyDown={(event) => {
            if (event.altKey && ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              props.onKeyboardMoveBoard(props.board, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1);
            }
          }}
        >
          <strong>{props.board.title}</strong>
        </button>
        <button className="board__add" onClick={() => props.onAddBookmark(props.board)} aria-label={t("board.add", { name: props.board.title })}><Plus size={17} /></button>
      </header>
      <div ref={drop.setNodeRef} className={`board__items board__items--columns-${columns}`}>
        <SortableContext items={props.bookmarks.map((bookmark) => `bookmark:${bookmark.id}`)} strategy={rectSortingStrategy}>
          {props.bookmarks.map((bookmark) => <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            privacy={props.privacy}
            selected={props.selectedIds.has(bookmark.id)}
            onOpen={props.onOpenBookmark}
            onEdit={props.onEditBookmark}
            onMove={props.onMoveBookmark}
            onDuplicate={props.onDuplicateBookmark}
            onDelete={props.onDeleteBookmark}
            onCopyUrl={props.onCopyUrl}
            onCopyMarkdown={props.onCopyMarkdown}
            onSelect={props.onSelectBookmark}
          />)}
        </SortableContext>
        {props.bookmarks.length === 0 ? <button className="board__empty" onClick={() => props.onAddBookmark(props.board)}>{t("board.empty")}</button> : null}
      </div>
      {menuPoint ? <FloatingContextMenu label={t("board.actions", { name: props.board.title })} point={menuPoint} onClose={() => setMenuPoint(null)}>
        <button onClick={() => action(() => props.onEditBoard(props.board))}><Pencil size={15} />{t("generic.rename")}</button>
        <div className="context-menu__group"><span>{t("board.columns")}</span>{(["auto", 1, 2] as const).map((value) => <button key={value} onClick={() => action(() => props.onPatchBoard(props.board, { bookmarkColumns: value }))}>{props.board.bookmarkColumns === value ? <Check size={14} /> : <i />}{t(value === "auto" ? "board.columnsAuto" : value === 1 ? "board.columnsOne" : "board.columnsTwo")}</button>)}</div>
        <div className="context-menu__group"><span>{t("board.size")}</span>{([2, 4, 6] as const).map((value) => <button key={value} onClick={() => action(() => props.onPatchBoard(props.board, { gridSpan: value }))}>{props.board.gridSpan === value ? <Check size={14} /> : <i />}{t(value === 2 ? "board.sizeSmall" : value === 4 ? "board.sizeMedium" : "board.sizeLarge")}</button>)}</div>
        <button onClick={() => action(() => props.onMoveBoard(props.board))}><MoveRight size={15} />{t("board.movePage")}</button>
        <button onClick={() => action(() => props.onDuplicateBoard(props.board))}><Copy size={15} />{t("generic.duplicate")}</button>
        <button className="danger" onClick={() => action(() => props.onDeleteBoard(props.board))}><Trash2 size={15} />{t("bookmark.moveTrash")}</button>
      </FloatingContextMenu> : null}
    </section>
  );
});
