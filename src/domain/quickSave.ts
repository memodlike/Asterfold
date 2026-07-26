import type { AppSettings, Board, Page } from "./models";

export interface QuickSaveDestination {
  pageId: string;
  boardId: string;
}

export function resolveQuickSaveDestination(
  settings: Pick<AppSettings,
    | "quickSaveDefaultPageId"
    | "quickSaveDefaultBoardId"
    | "quickSaveLastPageId"
    | "quickSaveLastBoardId">,
  pages: readonly Page[],
  boards: readonly Board[],
  preference: "default" | "last",
): QuickSaveDestination | null {
  const activePages = pages.filter((page) => page.deletedAt === null);
  const activeBoards = boards.filter((board) => board.deletedAt === null);
  const pageIds = new Set(activePages.map((page) => page.id));
  const boardById = new Map(activeBoards.map((board) => [board.id, board]));
  const pairs = preference === "last"
    ? [
      [settings.quickSaveLastPageId, settings.quickSaveLastBoardId],
      [settings.quickSaveDefaultPageId, settings.quickSaveDefaultBoardId],
    ]
    : [
      [settings.quickSaveDefaultPageId, settings.quickSaveDefaultBoardId],
      [settings.quickSaveLastPageId, settings.quickSaveLastBoardId],
    ];
  for (const [pageId, boardId] of pairs) {
    if (!pageId || !pageIds.has(pageId)) continue;
    const board = boardId ? boardById.get(boardId) : undefined;
    if (board?.pageId === pageId) return { pageId, boardId: board.id };
    const fallbackBoard = activeBoards.find((candidate) => candidate.pageId === pageId);
    if (fallbackBoard) return { pageId, boardId: fallbackBoard.id };
  }
  for (const page of activePages) {
    const board = activeBoards.find((candidate) => candidate.pageId === page.id);
    if (board) return { pageId: page.id, boardId: board.id };
  }
  return null;
}

export function resolvePageBoardSelection(
  pageId: string,
  currentBoardId: string,
  boards: readonly Board[],
): string {
  const pageBoards = boards.filter((board) => board.pageId === pageId && board.deletedAt === null);
  return pageBoards.some((board) => board.id === currentBoardId) ? currentBoardId : pageBoards[0]?.id ?? "";
}

export function isValidQuickSaveDestination(
  pageId: string,
  boardId: string,
  boards: readonly Board[],
): boolean {
  return boards.some((board) => board.id === boardId && board.pageId === pageId && board.deletedAt === null);
}

