import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const iconPath = (name: string): string => join(process.cwd(), "public", "icons", name);

describe("folded asterisk brand assets", () => {
  it.each([16, 32, 48, 128])("ships a %spx manifest PNG", async (size) => {
    const bytes = await readFile(iconPath(`icon-${size}.png`));
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  });

  it.each([
    "mark-16.svg",
    "mark-20.svg",
    "mark-24.svg",
    "mark-32.svg",
    "mark-light.svg",
    "mark-dark.svg",
    "mark-high-contrast.svg",
    "wordmark-horizontal.svg",
    "new-tab.svg",
  ])("ships %s without filters or remote assets", async (name) => {
    const svg = await readFile(iconPath(name), "utf8");
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/<filter|(?:href|src)=["']https?:\/\//iu);
  });
});
