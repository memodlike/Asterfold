import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { useState, type MouseEvent } from "react";
import { FolderPlus, GripVertical, Plus } from "lucide-react";
import type { Board, Bookmark, ThemeConfig } from "../../domain/models";
import { Button } from "../../components/Button";
import { BoardColumn } from "./BoardColumn";

interface BoardCanvasProps {
  boards: Board[];
  bookmarks: Bookmark[];
  privacy: boolean;
  selectedIds: Set<string>;
  theme: ThemeConfig;
  onCreateBoard: () => void;
  onAddBookmark: (board: Board) => void;
  onEditBoard: (board: Board) => void;
  onMoveBoard: (board: Board) => void;
  onDuplicateBoard: (board: Board) => void;
  onDeleteBoard: (board: Board) => void;
  onToggleBoard: (board: Board) => void;
  onToggleLayout: (board: Board) => void;
  onMoveBoardIndex: (id: string, index: number) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onMoveBookmark: (bookmark: Bookmark) => void;
  onDuplicateBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
  onCopyUrl: (bookmark: Bookmark) => void;
  onCopyMarkdown: (bookmark: Bookmark) => void;
  onSelectBookmark: (bookmark: Bookmark, event: MouseEvent) => void;
  onMoveBookmarkIndex: (id: string, boardId: string, index: number) => void;
  onImport: () => void;
}

export function BoardCanvas(props: BoardCanvasProps) {
  const [active, setActive] = useState<{ type: "board" | "bookmark"; title: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const bookmarksByBoard = new Map(props.boards.map((board) => [board.id, props.bookmarks.filter((bookmark) => bookmark.boardId === board.id)]));

  const handleStart = (event: DragStartEvent): void => {
    const data = event.active.data.current;
    if (data?.type === "board") {
      const board = props.boards.find((item) => item.id === data.boardId);
      setActive(board ? { type: "board", title: board.title } : null);
    } else if (data?.type === "bookmark") {
      const bookmark = props.bookmarks.find((item) => item.id === data.bookmarkId);
      setActive(bookmark ? { type: "bookmark", title: bookmark.title } : null);
    }
  };

  const handleEnd = (event: DragEndEvent): void => {
    setActive(null);
    if (!event.over || event.active.id === event.over.id) return;
    const source = event.active.data.current;
    const target = event.over.data.current;
    if (source?.type === "board") {
      const index = props.boards.findIndex((board) => `board:${board.id}` === event.over?.id);
      if (index >= 0) props.onMoveBoardIndex(String(source.boardId), index);
      return;
    }
    if (source?.type !== "bookmark") return;
    let targetBoardId: string | undefined;
    let targetIndex = Number.MAX_SAFE_INTEGER;
    if (target?.type === "bookmark") {
      targetBoardId = String(target.boardId);
      const targetItems = bookmarksByBoard.get(targetBoardId) ?? [];
      targetIndex = targetItems.findIndex((bookmark) => bookmark.id === target.bookmarkId);
    } else if (target?.type === "board" || target?.type === "board-drop") {
      targetBoardId = String(target.boardId);
      targetIndex = (bookmarksByBoard.get(targetBoardId) ?? []).length;
    }
    if (targetBoardId) props.onMoveBookmarkIndex(String(source.bookmarkId), targetBoardId, Math.max(0, targetIndex));
  };

  if (props.boards.length === 0) {
    return (
      <main className="canvas canvas--empty">
        <div className="empty-state">
          <span className="empty-state__icon"><FolderPlus size={31} /></span>
          <h2>Create your first board</h2>
          <p>Boards keep links grouped by project, topic, or anything that matters.</p>
          <Button variant="primary" icon={<Plus size={17} />} onClick={props.onCreateBoard}>Create your first board</Button>
          <Button variant="ghost" onClick={props.onImport}>Import bookmarks</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="canvas">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleStart} onDragCancel={() => setActive(null)} onDragEnd={handleEnd}>
        <SortableContext items={props.boards.map((board) => `board:${board.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="board-track">
            {props.boards.map((board) => (
              <BoardColumn
                key={board.id}
                board={board}
                bookmarks={bookmarksByBoard.get(board.id) ?? []}
                privacy={props.privacy}
                selectedIds={props.selectedIds}
                theme={props.theme}
                onAddBookmark={props.onAddBookmark}
                onEditBoard={props.onEditBoard}
                onMoveBoard={props.onMoveBoard}
                onDuplicateBoard={props.onDuplicateBoard}
                onDeleteBoard={props.onDeleteBoard}
                onToggleBoard={props.onToggleBoard}
                onToggleLayout={props.onToggleLayout}
                onOpenBookmark={props.onOpenBookmark}
                onEditBookmark={props.onEditBookmark}
                onMoveBookmark={props.onMoveBookmark}
                onDuplicateBookmark={props.onDuplicateBookmark}
                onDeleteBookmark={props.onDeleteBookmark}
                onCopyUrl={props.onCopyUrl}
                onCopyMarkdown={props.onCopyMarkdown}
                onSelectBookmark={props.onSelectBookmark}
              />
            ))}
            <button className="add-board-card" onClick={props.onCreateBoard}><Plus size={19} />Add board</button>
          </div>
        </SortableContext>
        {createPortal(
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
            {active ? <div className={`drag-overlay drag-overlay--${active.type}`}><GripVertical size={16} /><span>{active.title}</span></div> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </main>
  );
}
