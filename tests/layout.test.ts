import { describe, expect, it } from "vitest";
import type { Board } from "../src/domain/models";
import { packBoards } from "../src/features/boards/layout";

function board(id: string, gridColumn: number, gridRow: 0 | 1, gridSpan: number): Board {
  return { id, userId: null, pageId: "page", title: id, icon: null, accent: null, position: id, collapsed: false, layout: "list", bookmarkColumns: "auto", gridColumn, gridRow, gridSpan, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z", deletedAt: null, deletedBatchId: null, version: 1 };
}

describe("board packing", () => {
  it("packs conflicting free-grid preferences without overlaps", () => {
    const boards = [board("a", 1, 0, 4), board("b", 1, 0, 4), board("c", 4, 0, 6), board("d", 8, 1, 5)];
    const result = packBoards(boards, new Map(boards.map((item) => [item.id, 20])), 2, true);
    const occupied = new Set<string>();
    for (const placement of result.placements.values()) {
      expect(placement.column).toBeGreaterThanOrEqual(1);
      expect(placement.column + placement.span - 1).toBeLessThanOrEqual(12);
      for (let column = placement.column; column < placement.column + placement.span; column += 1) {
        const key = `${placement.row}:${column}`;
        expect(occupied.has(key), key).toBe(false);
        occupied.add(key);
      }
    }
  });

  it("keeps up to six automatic boards on one configured row", () => {
    const boards = Array.from({ length: 4 }, (_, index) => board(String(index), 1, 0, 6));
    const result = packBoards(boards, new Map(boards.map((item) => [item.id, 25])), 1, false);
    expect(result.rowCount).toBe(1);
    expect([...result.placements.values()].every((placement) => placement.row === 0 && placement.span === 3)).toBe(true);
  });
});
