import type { Board } from "../../domain/models";

export interface BoardPlacement {
  column: number;
  row: number;
  span: number;
}

export interface PackedBoards {
  placements: Map<string, BoardPlacement>;
  rowCount: number;
  usedColumns: number;
}

function preferredSpan(board: Board, bookmarkCount: number, free: boolean): number {
  if (free) return Math.max(2, Math.min(6, board.gridSpan));
  if (bookmarkCount >= 20) return 6;
  if (bookmarkCount >= 15) return 4;
  if (bookmarkCount >= 7) return 3;
  return 2;
}

function fits(occupied: boolean[][], row: number, column: number, span: number): boolean {
  if (column < 1 || column + span - 1 > 12) return false;
  const cells = occupied[row] ?? [];
  for (let offset = 0; offset < span; offset += 1) if (cells[column - 1 + offset]) return false;
  return true;
}

function occupy(occupied: boolean[][], row: number, column: number, span: number): void {
  occupied[row] ??= Array<boolean>(12).fill(false);
  for (let offset = 0; offset < span; offset += 1) occupied[row]![column - 1 + offset] = true;
}

export function packBoards(boards: Board[], bookmarkCounts: ReadonlyMap<string, number>, configuredRows: 1 | 2, free: boolean): PackedBoards {
  const placements = new Map<string, BoardPlacement>();
  const occupied: boolean[][] = [];
  let highestRow = 0;
  let usedColumns = 0;

  boards.forEach((board) => {
    const naturalSpan = preferredSpan(board, bookmarkCounts.get(board.id) ?? 0, free);
    const singleRowSpan = Math.max(2, Math.floor(12 / Math.max(1, boards.length)));
    const span = !free && configuredRows === 1 && boards.length <= 6 ? Math.min(naturalSpan, singleRowSpan) : naturalSpan;
    const preferredRow = free ? board.gridRow : 0;
    const preferredColumn = free ? Math.max(1, Math.min(13 - span, board.gridColumn)) : 1;
    let row: number = preferredRow;
    let column = preferredColumn;

    if (!fits(occupied, row, column, span)) {
      let found = false;
      for (let candidateRow = 0; !found; candidateRow += 1) {
        for (let candidateColumn = 1; candidateColumn <= 13 - span; candidateColumn += 1) {
          if (fits(occupied, candidateRow, candidateColumn, span)) {
            row = candidateRow;
            column = candidateColumn;
            found = true;
            break;
          }
        }
      }
    }

    occupy(occupied, row, column, span);
    placements.set(board.id, { column, row, span });
    highestRow = Math.max(highestRow, row);
    usedColumns = Math.max(usedColumns, column + span - 1);
  });

  return { placements, rowCount: Math.max(configuredRows, highestRow + 1), usedColumns: Math.max(1, usedColumns) };
}
