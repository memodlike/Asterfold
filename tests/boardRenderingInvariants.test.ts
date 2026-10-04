import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Board rendering & pointer highlight invariants", () => {
  const globalCssPath = resolve("src/styles/global.css");
  const globalCss = readFileSync(globalCssPath, "utf-8");

  it("enforces rounded-corner clipping with overflow: hidden instead of rectangular contain: paint on .board", () => {
    // Extract .board rule
    const boardRuleMatch = /\.board\s*\{([^}]+)\}/.exec(globalCss);
    expect(boardRuleMatch).not.toBeNull();
    const boardBody = boardRuleMatch![1]!;

    // Must have overflow: hidden so glare and inner layers clip to border-radius
    expect(boardBody).toContain("overflow: hidden");

    // Must NOT have contain: paint or layout style paint (which forces rectangular border-box clipping in Blink)
    expect(boardBody).not.toMatch(/contain:[^;]*paint/);

    // Must retain safe layout and style containment
    expect(boardBody).toContain("contain: layout style");
  });

  it("does not force content-visibility: auto or contain-intrinsic-size on workspace boards to avoid synthetic seam lines", () => {
    const boardRuleMatch = /\.board\s*\{([^}]+)\}/.exec(globalCss);
    expect(boardRuleMatch).not.toBeNull();
    const boardBody = boardRuleMatch![1]!;

    expect(boardBody).not.toContain("content-visibility: auto");
    expect(boardBody).not.toContain("contain-intrinsic-size");
  });

  it("does not promote .board__glare to a separate hardware layer with will-change to avoid backdrop-filter tile damage conflicts", () => {
    const glareLitMatch = /\.board\.is-lit\s+\.board__glare\s*\{([^}]+)\}/.exec(globalCss);
    expect(glareLitMatch).not.toBeNull();
    const glareLitBody = glareLitMatch![1]!;

    expect(glareLitBody).not.toContain("will-change: transform");
    expect(glareLitBody).toContain("opacity: 1");
  });
});
