import { describe, expect, it } from "vitest";
import { analyzePastedLinks } from "../src/domain/pasteLinks";

describe("pasted link extraction", () => {
  it("extracts one HTTP link and derives a local title", () => {
    expect(analyzePastedLinks("https://github.com").items).toEqual([{ url: "https://github.com/", title: "GitHub" }]);
  });
  it("extracts multiline lists and links inside prose, trimming sentence punctuation", () => {
    expect(analyzePastedLinks("Read https://example.com/a.\nAlso <http://example.org/b> and (https://example.net/c).\nhttps://en.wikipedia.org/wiki/Function_(mathematics)").urls).toEqual([
      "https://example.com/a", "http://example.org/b", "https://example.net/c", "https://en.wikipedia.org/wiki/Function_(mathematics)",
    ]);
  });
  it.each(["javascript:alert(1)", "data:text/html,hello", "file:///secret", "mailto:me@example.com", "javascript:https://example.com", "data:text/html,https://example.com", "https://user:pass@example.com"])("rejects unsafe candidate %s", (text) => {
    expect(analyzePastedLinks(text)).toMatchObject({ urls: [], items: [], invalid: 1 });
  });
  it("handles nested prose wrappers and long punctuation runs without changing balanced URL parentheses", () => {
    expect(analyzePastedLinks("Read [https://example.com/path)].").urls).toEqual(["https://example.com/path"]);
    expect(analyzePastedLinks(`https://example.com/${")".repeat(90000)}`).urls).toEqual(["https://example.com/"]);
  });
  it("counts nonempty lines without valid links as invalid", () => {
    expect(analyzePastedLinks("hello\n\n https://example.com and other words\nnot a link").invalid).toBe(2);
  });
  it("caps all valid occurrences at 200, including repeats", () => {
    const result = analyzePastedLinks(Array.from({ length: 205 }, (_, index) => `https://example.com/${index}`).join("\n"));
    expect(result.items).toHaveLength(200);
    expect(result.urls.at(-1)).toBe("https://example.com/199");
    expect(analyzePastedLinks("https://example.com\n".repeat(205)).duplicate).toBe(199);
  });
  it("ignores text longer than 100000 characters", () => {
    expect(analyzePastedLinks(`https://example.com ${"x".repeat(100000)}`)).toEqual({ urls: [], items: [], duplicate: 0, invalid: 0 });
  });
  it("normalizes repeats within text and existing destination links", () => {
    expect(analyzePastedLinks("https://EXAMPLE.com:443/?utm_source=a\nhttps://example.com/#hash\nhttps://github.com", ["https://github.com/"])).toMatchObject({
      items: [{ url: "https://example.com/?utm_source=a", title: "Example" }], duplicate: 2, invalid: 0,
    });
  });
});
