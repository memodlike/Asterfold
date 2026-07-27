import { describe, expect, it } from "vitest";
import type { AppSettings, Board, Page } from "../src/domain/models";
import { isValidQuickSaveDestination, resolvePageBoardSelection, resolveQuickSaveDestination } from "../src/domain/quickSave";

const pages = [
  { id: "page-a", deletedAt: null },
  { id: "page-b", deletedAt: null },
] as Page[];
const boards = [
  { id: "board-a", pageId: "page-a", deletedAt: null },
  { id: "board-b", pageId: "page-b", deletedAt: null },
] as Board[];
const settings = {
  quickSaveDefaultPageId: "page-a",
  quickSaveDefaultBoardId: "board-a",
  quickSaveLastPageId: "page-b",
  quickSaveLastBoardId: "board-a",
} as AppSettings;

describe("Quick Save destination resolution", () => {
  it("never returns a Board that belongs to another Page", () => {
    expect(resolveQuickSaveDestination(settings, pages, boards, "last")).toEqual({
      pageId: "page-b",
      boardId: "board-b",
    });
  });

  it("falls back to a complete valid pair when saved references are stale", () => {
    expect(resolveQuickSaveDestination({
      ...settings,
      quickSaveDefaultPageId: "missing",
      quickSaveDefaultBoardId: "missing",
      quickSaveLastPageId: "missing",
      quickSaveLastBoardId: "missing",
    }, pages, boards, "default")).toEqual({
      pageId: "page-a",
      boardId: "board-a",
    });
  });

  it("clears a stale Board when the selected Page has no Boards", () => {
    expect(resolvePageBoardSelection("page-b", "board-a", boards.filter((board) => board.id !== "board-b"))).toBe("");
    expect(isValidQuickSaveDestination("page-b", "board-a", boards)).toBe(false);
  });

  it("keeps only an active Board that belongs to the selected Page", () => {
    expect(resolvePageBoardSelection("page-b", "board-b", boards)).toBe("board-b");
    expect(isValidQuickSaveDestination("page-b", "board-b", boards)).toBe(true);
    expect(isValidQuickSaveDestination("page-b", "board-a", boards)).toBe(false);
  });

});
