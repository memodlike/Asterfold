import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("balanced renderer", () => {
  it("does not register document listeners per board or bookmark", () => {
    const board = readFileSync(`${process.cwd()}/src/features/boards/BoardColumn.tsx`, "utf8");
    const bookmark = readFileSync(`${process.cwd()}/src/features/bookmarks/BookmarkCard.tsx`, "utf8");
    expect(board).not.toContain('document.addEventListener("pointerdown"');
    expect(bookmark).not.toContain('document.addEventListener("pointerdown"');
  });

  it("keeps backdrop filtering off individual boards", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/global.css`, "utf8");
    const boardRule = /\.board \{[^}]+\}/u.exec(css)?.[0] ?? "";
    expect(boardRule).not.toContain("backdrop-filter");
  });
});
