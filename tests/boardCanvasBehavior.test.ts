import { createElement, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { Board, Bookmark } from "../src/domain/models";

type CanvasProps = Parameters<typeof import("../src/features/boards/BoardCanvas").BoardCanvas>[0];
type ColumnProps = Parameters<typeof import("../src/features/boards/BoardColumn").BoardColumn>[0];

interface DndProps {
  children: ReactNode;
  collisionDetection: (args: unknown) => unknown;
  onDragStart: (event: unknown) => void;
  onDragCancel: () => void;
  onDragEnd: (event: unknown) => void;
}

const mocks = vi.hoisted(() => ({
  dndProps: null as DndProps | null,
  columns: [] as ColumnProps[],
  closestCorners: vi.fn().mockReturnValue([{ id: "target" }]),
  keyboardGetter: null as ((event: KeyboardEvent, args: unknown) => unknown) | null,
}));

vi.mock("@dnd-kit/core", async () => {
  const { createElement: h, Fragment } = await import("react");
  return {
    DndContext: (props: DndProps) => { mocks.dndProps = props; return h(Fragment, null, props.children); },
    DragOverlay: ({ children }: { children: ReactNode }) => h(Fragment, null, children),
    KeyboardSensor: Symbol("KeyboardSensor"),
    MeasuringStrategy: { BeforeDragging: "BeforeDragging" },
    PointerSensor: Symbol("PointerSensor"),
    closestCorners: mocks.closestCorners,
    useSensor: (sensor: unknown, options?: { coordinateGetter?: (event: KeyboardEvent, args: unknown) => unknown }) => {
      if (options?.coordinateGetter) mocks.keyboardGetter = options.coordinateGetter;
      return { sensor, options };
    },
    useSensors: (...sensors: unknown[]) => sensors,
  };
});
vi.mock("@dnd-kit/sortable", async () => {
  const { createElement: h, Fragment } = await import("react");
  return {
    SortableContext: ({ children }: { children: ReactNode }) => h(Fragment, null, children),
    rectSortingStrategy: vi.fn(),
    sortableKeyboardCoordinates: vi.fn().mockReturnValue({ x: 9, y: 9 }),
  };
});
vi.mock("../src/features/boards/BoardColumn", () => ({
  BoardColumn: (props: ColumnProps) => { mocks.columns.push(props); return createElement("div", { "data-testid": `column-${props.board.id}` }, props.board.title); },
}));

import { BoardCanvas } from "../src/features/boards/BoardCanvas";
import { I18nProvider } from "../src/i18n";

const timestamp = "2026-01-01T00:00:00.000Z";
const board: Board = { id: "board", userId: null, pageId: "page", title: "Inbox", icon: null, accent: null, position: "0001", collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn: 1, gridRow: 0, gridSpan: 3, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const boardTwo: Board = { ...board, id: "board-two", title: "Later", position: "0002", gridColumn: 4 };
const bookmark: Bookmark = { id: "bookmark", userId: null, boardId: board.id, title: "Example", url: "https://example.com/", normalizedUrl: "https://example.com/", hostname: "example.com", description: null, faviconUrl: null, customIcon: null, position: "0001", openMode: "current", pinned: false, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deletedBatchId: null, version: 1 };
const bookmarkTwo: Bookmark = { ...bookmark, id: "bookmark-two", boardId: boardTwo.id, title: "Second" };

function callbacks() {
  return {
    onCreateBoard: vi.fn(), onAddBookmark: vi.fn(), onEditBoard: vi.fn(), onPatchBoard: vi.fn(), onMoveBoard: vi.fn(), onDuplicateBoard: vi.fn(), onDeleteBoard: vi.fn(), onMoveBoardIndex: vi.fn(),
    onOpenBookmark: vi.fn(), onEditBookmark: vi.fn(), onMoveBookmark: vi.fn(), onDuplicateBookmark: vi.fn(), onDeleteBookmark: vi.fn(), onCopyUrl: vi.fn(), onCopyMarkdown: vi.fn(), onSelectBookmark: vi.fn(), onMoveBookmarkIndex: vi.fn(), onImport: vi.fn(),
  };
}

function renderCanvas(overrides: Partial<CanvasProps> = {}) {
  const handlers = callbacks();
  const settings = createDefaultSettings();
  const props: CanvasProps = {
    boards: [board, boardTwo], bookmarks: [bookmark, bookmarkTwo], privacy: false, selectedIds: new Set(),
    settings: { workspaceLayoutMode: settings.workspaceLayoutMode, workspaceRows: settings.workspaceRows, workspaceAlignment: settings.workspaceAlignment },
    ...handlers,
    ...overrides,
  };
  const view = render(createElement(I18nProvider, { preference: "en", children: createElement(BoardCanvas, props) }));
  return { ...view, props, handlers };
}

beforeEach(() => {
  mocks.dndProps = null;
  mocks.columns = [];
  mocks.keyboardGetter = null;
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("BoardCanvas behavior", () => {
  it("offers create and import actions for an empty workspace", () => {
    const { handlers } = renderCanvas({ boards: [], bookmarks: [] });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    expect(handlers.onCreateBoard).toHaveBeenCalledOnce();
    expect(handlers.onImport).toHaveBeenCalledOnce();
  });

  it("groups bookmarks and routes board keyboard movement", () => {
    const { handlers } = renderCanvas();
    expect(mocks.columns).toHaveLength(2);
    expect(mocks.columns[0]?.bookmarks).toEqual([bookmark]);
    expect(mocks.columns[1]?.bookmarks).toEqual([bookmarkTwo]);
    mocks.columns[0]?.onKeyboardMoveBoard(board, 1);
    expect(handlers.onMoveBoardIndex).toHaveBeenCalledWith(board.id, 1, boardTwo.id);
    mocks.columns[1]?.onKeyboardMoveBoard(boardTwo, -1);
    expect(handlers.onMoveBoardIndex).toHaveBeenCalledWith(boardTwo.id, 0, board.id);
  });

  it("routes board and bookmark drag completions", () => {
    const { handlers } = renderCanvas();
    act(() => {
      mocks.dndProps?.onDragStart({ active: { data: { current: { type: "board", boardId: board.id } } } });
    });
    expect(screen.getByText(board.title, { selector: ".drag-overlay span" })).toBeVisible();
    act(() => { mocks.dndProps?.onDragCancel(); });

    mocks.dndProps?.onDragEnd({
      active: { id: `board:${board.id}`, data: { current: { type: "board", boardId: board.id } } },
      over: { id: `board:${boardTwo.id}`, data: { current: { type: "board", boardId: boardTwo.id } } },
    });
    expect(handlers.onMoveBoardIndex).toHaveBeenCalledWith(board.id, 1, boardTwo.id);

    mocks.dndProps?.onDragEnd({
      active: { id: `bookmark:${bookmark.id}`, data: { current: { type: "bookmark", bookmarkId: bookmark.id } } },
      over: { id: `bookmark:${bookmarkTwo.id}`, data: { current: { type: "bookmark", bookmarkId: bookmarkTwo.id, boardId: boardTwo.id } } },
    });
    expect(handlers.onMoveBookmarkIndex).toHaveBeenCalledWith(bookmark.id, boardTwo.id, 0);

    mocks.dndProps?.onDragEnd({
      active: { id: `bookmark:${bookmark.id}`, data: { current: { type: "bookmark", bookmarkId: bookmark.id } } },
      over: { id: `board-drop:${boardTwo.id}`, data: { current: { type: "board-drop", boardId: boardTwo.id } } },
    });
    expect(handlers.onMoveBookmarkIndex).toHaveBeenCalledWith(bookmark.id, boardTwo.id, 1);

    mocks.dndProps?.onDragEnd({ active: { id: "same", data: { current: { type: "bookmark" } } }, over: { id: "same", data: { current: {} } } });
    mocks.dndProps?.onDragEnd({ active: { id: "none", data: { current: {} } }, over: null });
  });

  it("filters collision targets and calculates board keyboard coordinates", () => {
    renderCanvas();
    const containers = [
      { id: `board:${board.id}`, data: { current: { type: "board", boardId: board.id } } },
      { id: `board:${boardTwo.id}`, data: { current: { type: "board", boardId: boardTwo.id } } },
      { id: `bookmark:${bookmark.id}`, data: { current: { type: "bookmark", boardId: board.id } } },
    ];
    mocks.dndProps?.collisionDetection({ active: { id: `board:${board.id}`, data: { current: { type: "board" } } }, droppableContainers: { filter: (predicate: (value: (typeof containers)[number]) => boolean) => containers.filter(predicate) } });
    expect(mocks.closestCorners).toHaveBeenCalled();

    const preventDefault = vi.fn();
    const rects = new Map([[`board:${boardTwo.id}`, { left: 40, top: 20 }]]);
    const result = mocks.keyboardGetter?.({ code: "ArrowRight", preventDefault } as unknown as KeyboardEvent, {
      context: { active: { id: `board:${board.id}`, data: { current: { type: "board" } } }, droppableRects: rects },
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(result).toEqual({ x: 40, y: 20 });
    expect(mocks.keyboardGetter?.({ code: "Enter", preventDefault } as unknown as KeyboardEvent, { context: { active: { data: { current: { type: "board" } } }, droppableRects: rects } })).toBeUndefined();
  });

  it("hides bookmark titles in the drag overlay while privacy mode is active", () => {
    renderCanvas({ privacy: true });
    act(() => {
      mocks.dndProps?.onDragStart({ active: { data: { current: { type: "bookmark", bookmarkId: bookmark.id } } } });
    });
    expect(screen.getByText("Hidden bookmark")).toBeVisible();
  });
});
