import { describe, expect, it } from "vitest";
import { evenlySpacedRanks, isValidRank, rankBetween } from "../src/domain/ordering";
import { getThemePreset, validateTheme } from "../src/domain/themes";
import { isSafeOpenUrl, normalizeUrl, parseSafeNavigationUrl } from "../src/domain/urls";
import { parseExtensionMessage } from "../src/browser/messages";

describe("position keys", () => {
  it("creates stable sorted ranks and inserts between neighbors", () => {
    const ranks = evenlySpacedRanks(100);
    expect(ranks).toHaveLength(100);
    expect([...ranks].sort()).toEqual(ranks);
    expect(new Set(ranks).size).toBe(100);
    expect(ranks.every(isValidRank)).toBe(true);

    const middle = rankBetween(ranks[10]!, ranks[11]!);
    expect(middle).not.toBeNull();
    expect(ranks[10]! < middle! && middle! < ranks[11]!).toBe(true);
  });

  it("signals an exhausted gap and rejects reversed bounds", () => {
    expect(rankBetween("000000000000", "000000000001")).toBeNull();
    expect(() => rankBetween("zzzzzzzzzzzz", "000000000001")).toThrow(/reversed/u);
  });
});

describe("URL safety", () => {
  it("normalizes host, default port, tracking parameters, and fragments", () => {
    const result = normalizeUrl("https://WWW.Example.com:443/docs?utm_source=test&b=1#intro");
    expect(result.normalizedUrl).toBe("https://www.example.com/docs?b=1");
    expect(result.hostname).toBe("example.com");
  });

  it.each(["javascript:alert(1)", "data:text/html,hello", "file:///tmp/a", "chrome://settings", "not a URL"])(
    "rejects unsafe input %s",
    (url) => {
      expect(isSafeOpenUrl(url)).toBe(false);
      expect(() => normalizeUrl(url)).toThrow();
    },
  );

  it("allows explicit mail links without treating them as web origins", () => {
    expect(normalizeUrl("mailto:hello@example.com").hostname).toBe("Email");
  });

  it.each([
    "https://user@example.com/private",
    "https://user:password@example.com/private",
    "https://%75ser@example.com/private",
    "https://example.com/\nnext",
    "https://example.com/\u0000next",
  ])("rejects credentials and control characters: %s", (url) => {
    expect(() => parseSafeNavigationUrl(url)).toThrow();
  });

  it("canonicalizes mixed-case and Unicode origins without changing path or query", () => {
    const parsed = parseSafeNavigationUrl("HTTPS://BÜCHER.example:443/A%2Fb?q=%2F#part");
    expect(parsed).toBe("https://xn--bcher-kva.example/A%2Fb?q=%2F#part");
  });

  it("rejects oversized URLs and all privileged or executable schemes", () => {
    expect(() => parseSafeNavigationUrl(`https://example.com/${"a".repeat(8_200)}`)).toThrow();
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "file:///tmp/a",
      "chrome://settings",
      "chrome-extension://id/page.html",
      "blob:https://example.com/id",
      "about:blank",
    ]) {
      expect(() => parseSafeNavigationUrl(url)).toThrow();
    }
  });

  it("allows mailto only when the caller opts into the mail flow", () => {
    expect(() => parseSafeNavigationUrl("mailto:hello@example.com")).toThrow();
    expect(parseSafeNavigationUrl("MAILTO:hello@example.com", { allowMailto: true })).toBe("mailto:hello@example.com");
  });
});

describe("themes and runtime messages", () => {
  it("clamps every user-controlled numeric theme value", () => {
    const validated = validateTheme({
      ...getThemePreset("aurora"),
      surfaceOpacity: 8,
      blur: -5,
      radius: 200,
      fontScale: 4,
      boardWidth: 50,
      faviconSize: 100,
      wallpaperDim: -1,
      wallpaperZoom: 9,
      accent: "red",
    });
    expect(validated).toMatchObject({
      surfaceOpacity: 1,
      blur: 0,
      radius: 28,
      fontScale: 1.25,
      boardWidth: 280,
      faviconSize: 48,
      wallpaperDim: 0,
      wallpaperZoom: 2,
      accent: "#155eef",
    });
  });

  it("accepts only the closed extension command union", () => {
    expect(parseExtensionMessage({ type: "OPEN_URL", url: "https://example.com", mode: "new-tab" })).toEqual({
      type: "OPEN_URL",
      url: "https://example.com",
      mode: "new-tab",
    });
    expect(parseExtensionMessage({ type: "DELETE_DATABASE" })).toBeNull();
    expect(parseExtensionMessage({ type: "OPEN_URL", url: "https://example.com", mode: "eval" })).toBeNull();
    expect(parseExtensionMessage({ type: "OPEN_URL", url: "https://example.com", mode: "current", extra: true })).toBeNull();
    expect(parseExtensionMessage({ type: "QUICK_SAVE", tabId: 0 })).toBeNull();
    expect(parseExtensionMessage({ type: "QUICK_SAVE", tabId: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
    expect(parseExtensionMessage({ type: "OPEN_WORKSPACE", pageId: "" })).toBeNull();
    expect(parseExtensionMessage({ type: "INSTANT_SAVE", url: "https://example.com", title: "x".repeat(241) })).toBeNull();
  });
});
