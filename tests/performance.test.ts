import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("balanced renderer", () => {
  it("does not register document listeners per board or bookmark", () => {
    const board = readFileSync(`${process.cwd()}/src/features/boards/BoardColumn.tsx`, "utf8");
    const bookmark = readFileSync(`${process.cwd()}/src/features/bookmarks/BookmarkCard.tsx`, "utf8");
    expect(board).not.toContain('document.addEventListener("pointerdown"');
    expect(bookmark).not.toContain('document.addEventListener("pointerdown"');
  });

  it("frosts boards through the tiered --board-filter token only", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/global.css`, "utf8");
    const material = readFileSync(`${process.cwd()}/src/styles/material.css`, "utf8");
    const boardRule = /\.board \{[^}]+\}/u.exec(css)?.[0] ?? "";
    // Boards never hard-code a blur; the rendering tier decides through one token.
    expect(boardRule).toContain("backdrop-filter: var(--board-filter)");
    expect(boardRule).not.toMatch(/backdrop-filter:\s*blur/u);
    const root = /:root \{[^}]+\}/u.exec(material)?.[0] ?? "";
    expect(root).toMatch(/--board-filter: blur\(var\(--glass-blur/u);
    const balanced = /html\[data-performance="balanced"\] \{[^}]+\}/u.exec(material)?.[0] ?? "";
    expect(balanced).toMatch(/--board-filter: blur\(min\(8px/u);
    for (const tier of ["compatibility", "software"]) {
      const block = new RegExp(`html\\[data-performance="${tier}"\\] \\{[^}]+\\}`, "u").exec(material)?.[0] ?? "";
      expect(block, tier).toContain("--board-filter: none");
    }
  });

  it("keeps the drag preview on the shared glass material", () => {
    const css = readFileSync(`${process.cwd()}/src/styles/global.css`, "utf8");
    const material = readFileSync(`${process.cwd()}/src/styles/material.css`, "utf8");
    const dragRule = /\.drag-overlay \{[^}]+\}/u.exec(css)?.[0] ?? "";
    expect(dragRule).not.toMatch(/background:\s*#/u);
    expect(material).toMatch(/:is\([^)]*\.drag-overlay[^)]*\)/u);
  });
});
