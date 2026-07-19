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
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { useCallback, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { FolderPlus, Plus } from "lucide-react";
import type { AppSettings, Board, Bookmark, ThemeConfig } from "../../domain/models";
import { Button } from "../../components/Button";
import { useI18n } from "../../i18n";
import { BoardColumn } from "./BoardColumn";
import { packBoards } from "./layout";

interface BoardCanvasProps {
  boards: Board[];
  bookmarks: Bookmark[];
  privacy: boolean;
  selectedIds: Set<string>;
  theme: ThemeConfig;
  settings: Pick<AppSettings, "workspaceLayoutMode" | "workspaceRows" | "workspaceAlignment">;
  onCreateBoard: () => void;
  onAddBookmark: (board: Board) => void;
  onEditBoard: (board: Board) => void;
  onPatchBoard: (board: Board, patch: Partial<Pick<Board, "bookmarkColumns" | "gridSpan">>) => void;
  onMoveBoard: (board: Board) => void;
  onDuplicateBoard: (board: Board) => void;
  onDeleteBoard: (board: Board) => void;
  onMoveBoardIndex: (id: string, index: number, targetId: string) => void;
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

function dndType(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("type" in data)) return undefined;
  const type = (data as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

export function BoardCanvas(props: BoardCanvasProps) {
  const { t } = useI18n();
  const [active, setActive] = useState<{ type: "board" | "bookmark"; title: string } | null>(null);
  const keyboardCoordinates = useCallback<KeyboardCoordinateGetter>((event, args) => {
    if (args.context.active?.data.current?.type !== "board") return sortableKeyboardCoordinates(event, args);
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) return undefined;
    event.preventDefault();
    const boardIds = props.boards.map((board) => `board:${board.id}`);
    const activeIndex = boardIds.indexOf(String(args.context.active.id));
    const delta = event.code === "ArrowRight" || event.code === "ArrowDown" ? 1 : -1;
    const targetId = boardIds[activeIndex + delta];
    const targetRect = targetId ? args.context.droppableRects.get(targetId) : undefined;
    return targetRect ? { x: targetRect.left, y: targetRect.top } : undefined;
  }, [props.boards]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  const bookmarksByBoard = useMemo(() => {
    const groups = new Map(props.boards.map((board) => [board.id, [] as Bookmark[]]));
    for (const bookmark of props.bookmarks) groups.get(bookmark.boardId)?.push(bookmark);
    return groups;
  }, [props.boards, props.bookmarks]);
  const bookmarkCounts = useMemo(() => new Map([...bookmarksByBoard].map(([id, items]) => [id, items.length])), [bookmarksByBoard]);
  const packed = useMemo(
    () => packBoards(props.boards, bookmarkCounts, props.settings.workspaceRows, props.settings.workspaceLayoutMode === "free"),
    [bookmarkCounts, props.boards, props.settings.workspaceLayoutMode, props.settings.workspaceRows],
  );
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeType = dndType(args.active.data.current);
    const droppableContainers = args.droppableContainers.filter((container) => {
      const targetType = dndType(container.data.current);
      return activeType === "board"
        ? targetType === "board" && container.id !== args.active.id
        : targetType === "bookmark" || targetType === "board-drop";
    });
    return closestCorners({ ...args, droppableContainers });
  }, []);

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
      const targetId = target?.boardId ? String(target.boardId) : String(event.over.id).replace("board:", "");
      const index = props.boards.findIndex((board) => board.id === targetId);
      if (index >= 0) props.onMoveBoardIndex(String(source.boardId), index, targetId);
      return;
    }
    if (source?.type !== "bookmark") return;
    let targetBoardId: string | undefined;
    let targetIndex = Number.MAX_SAFE_INTEGER;
    if (target?.type === "bookmark") {
      targetBoardId = String(target.boardId);
      targetIndex = (bookmarksByBoard.get(targetBoardId) ?? []).findIndex((bookmark) => bookmark.id === target.bookmarkId);
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
          <span className="empty-state__icon"><FolderPlus size={29} /></span>
          <h2>{t("board.createFirst")}</h2>
          <p>{t("board.createFirstDescription")}</p>
          <Button variant="primary" icon={<Plus size={17} />} onClick={props.onCreateBoard}>{t("generic.create")}</Button>
          <Button variant="ghost" onClick={props.onImport}>{t("settings.importFile")}</Button>
        </div>
      </main>
    );
  }

  const trackStyle = {
    "--board-rows": packed.rowCount,
    "--used-columns": packed.usedColumns,
  } as CSSProperties;

  return (
    <main className="canvas">
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleStart} onDragCancel={() => setActive(null)} onDragEnd={handleEnd}>
        <SortableContext items={props.boards.map((board) => `board:${board.id}`)} strategy={rectSortingStrategy}>
          <div className={`board-track board-track--${props.settings.workspaceAlignment}`} style={trackStyle}>
            {props.boards.map((board) => {
              const placement = packed.placements.get(board.id);
              return <BoardColumn
                key={board.id}
                board={board}
                placement={placement}
                bookmarks={bookmarksByBoard.get(board.id) ?? []}
                privacy={props.privacy}
                selectedIds={props.selectedIds}
                theme={props.theme}
                onAddBookmark={props.onAddBookmark}
                onEditBoard={props.onEditBoard}
                onPatchBoard={props.onPatchBoard}
                onMoveBoard={props.onMoveBoard}
                onDuplicateBoard={props.onDuplicateBoard}
                onDeleteBoard={props.onDeleteBoard}
                onKeyboardMoveBoard={(movingBoard, delta) => {
                  const index = props.boards.findIndex((candidate) => candidate.id === movingBoard.id);
                  const targetIndex = Math.max(0, Math.min(props.boards.length - 1, index + delta));
                  const target = props.boards[targetIndex];
                  if (target && targetIndex !== index) props.onMoveBoardIndex(movingBoard.id, targetIndex, target.id);
                }}
                onOpenBookmark={props.onOpenBookmark}
                onEditBookmark={props.onEditBookmark}
                onMoveBookmark={props.onMoveBookmark}
                onDuplicateBookmark={props.onDuplicateBookmark}
                onDeleteBookmark={props.onDeleteBookmark}
                onCopyUrl={props.onCopyUrl}
                onCopyMarkdown={props.onCopyMarkdown}
                onSelectBookmark={props.onSelectBookmark}
              />;
            })}
          </div>
        </SortableContext>
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {active ? <div className={`drag-overlay drag-overlay--${active.type}`}><span>{active.title}</span></div> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </main>
  );
}
