import { describe, expect, it } from "vitest";
import {
  extractRootDomain,
  isUnusableTitle,
  normalizeSiteIdentity,
  recoverBookmarkTitle,
} from "../src/domain/bookmarkNaming";

describe("smart bookmark naming", () => {
  describe("isUnusableTitle", () => {
    it("identifies empty, whitespace, and nullish titles as unusable", () => {
      expect(isUnusableTitle("", "https://github.com")).toBe(true);
      expect(isUnusableTitle("   ", "https://github.com")).toBe(true);
      expect(isUnusableTitle(null, "https://github.com")).toBe(true);
      expect(isUnusableTitle(undefined, "https://github.com")).toBe(true);
    });

    it("identifies generic placeholder titles as unusable", () => {
      expect(isUnusableTitle("Bookmark", "https://github.com")).toBe(true);
      expect(isUnusableTitle("bookmark", "https://github.com")).toBe(true);
      expect(isUnusableTitle("Untitled", "https://github.com")).toBe(true);
      expect(isUnusableTitle("Untitled bookmark", "https://github.com")).toBe(true);
      expect(isUnusableTitle("New Tab", "https://github.com")).toBe(true);
      expect(isUnusableTitle("link", "https://github.com")).toBe(true);
    });

    it("identifies raw URLs and hostnames as unusable", () => {
      expect(isUnusableTitle("https://www.youtube.com/watch?v=12345", "https://www.youtube.com/watch?v=12345")).toBe(true);
      expect(isUnusableTitle("http://github.com/memodlike/Asterfold", "http://github.com/memodlike/Asterfold")).toBe(true);
      expect(isUnusableTitle("www.youtube.com", "https://www.youtube.com")).toBe(true);
      expect(isUnusableTitle("youtube.com", "https://youtube.com")).toBe(true);
      expect(isUnusableTitle("figma.com", "https://figma.com/files")).toBe(true);
      expect(isUnusableTitle("www.example.kz", "https://www.example.kz")).toBe(true);
    });

    it("preserves genuine, meaningful user titles", () => {
      expect(isUnusableTitle("My Favorite YouTube Video", "https://youtube.com")).toBe(false);
      expect(isUnusableTitle("Asterfold Extension Repository", "https://github.com")).toBe(false);
      expect(isUnusableTitle("Project Sprint Backlog", "https://notion.so")).toBe(false);
      expect(isUnusableTitle("Design System 2026", "https://figma.com")).toBe(false);
      expect(isUnusableTitle("Google Search", "https://google.com")).toBe(false);
    });
  });

  describe("extractRootDomain", () => {
    it("handles standard single-part TLDs", () => {
      expect(extractRootDomain("youtube.com").rootLabel).toBe("youtube");
      expect(extractRootDomain("www.github.com").rootLabel).toBe("github");
      expect(extractRootDomain("sub.notion.so").rootLabel).toBe("notion");
    });

    it("handles multi-part public suffixes", () => {
      expect(extractRootDomain("bbc.co.uk").rootLabel).toBe("bbc");
      expect(extractRootDomain("www.service.gov.uk").rootLabel).toBe("service");
      expect(extractRootDomain("news.com.au").rootLabel).toBe("news");
      expect(extractRootDomain("travel.co.jp").rootLabel).toBe("travel");
      expect(extractRootDomain("bank.com.br").rootLabel).toBe("bank");
    });
  });

  describe("normalizeSiteIdentity", () => {
    it("recognizes well-known brands with official casing", () => {
      expect(normalizeSiteIdentity("https://www.youtube.com/watch?v=xyz")).toBe("YouTube");
      expect(normalizeSiteIdentity("https://m.youtube.com")).toBe("YouTube");
      expect(normalizeSiteIdentity("https://github.com/features")).toBe("GitHub");
      expect(normalizeSiteIdentity("https://gitlab.com")).toBe("GitLab");
      expect(normalizeSiteIdentity("https://www.notion.so/workspace")).toBe("Notion");
      expect(normalizeSiteIdentity("https://figma.com/@designer")).toBe("Figma");
      expect(normalizeSiteIdentity("https://www.linkedin.com/feed")).toBe("LinkedIn");
      expect(normalizeSiteIdentity("https://chatgpt.com")).toBe("ChatGPT");
      expect(normalizeSiteIdentity("https://reddit.com/r/webdev")).toBe("Reddit");
      expect(normalizeSiteIdentity("https://netflix.com/browse")).toBe("Netflix");
      expect(normalizeSiteIdentity("https://spotify.com")).toBe("Spotify");
      expect(normalizeSiteIdentity("https://en.wikipedia.org/wiki/Aster")).toBe("Wikipedia");
      expect(normalizeSiteIdentity("https://stackoverflow.com/questions")).toBe("Stack Overflow");
    });

    it("recognizes product subdomains for major suites", () => {
      expect(normalizeSiteIdentity("https://docs.google.com/document/d/123")).toBe("Google Docs");
      expect(normalizeSiteIdentity("https://sheets.google.com/spreadsheets/d/123")).toBe("Google Sheets");
      expect(normalizeSiteIdentity("https://drive.google.com/drive/my-drive")).toBe("Google Drive");
      expect(normalizeSiteIdentity("https://mail.google.com/mail/u/0")).toBe("Gmail");
      expect(normalizeSiteIdentity("https://calendar.google.com")).toBe("Google Calendar");
      expect(normalizeSiteIdentity("https://gist.github.com/memodlike/123")).toBe("GitHub Gist");
      expect(normalizeSiteIdentity("https://news.ycombinator.com")).toBe("Hacker News");
      expect(normalizeSiteIdentity("https://web.telegram.org/k/")).toBe("Telegram");
      expect(normalizeSiteIdentity("https://t.me/channel")).toBe("Telegram");
    });

    it("formats unknown domains cleanly into title case without TLD or www", () => {
      expect(normalizeSiteIdentity("https://my-cool-startup.com/about")).toBe("My Cool Startup");
      expect(normalizeSiteIdentity("https://www.developer-tools.io")).toBe("Developer Tools");
      expect(normalizeSiteIdentity("https://subdomain.local-library.org")).toBe("Local Library");
      expect(normalizeSiteIdentity("https://example.kz")).toBe("Example");
    });

    it("handles localhost, IP addresses, and special protocols", () => {
      expect(normalizeSiteIdentity("http://localhost:3000/dashboard")).toBe("Localhost (3000)");
      expect(normalizeSiteIdentity("http://localhost")).toBe("Localhost");
      expect(normalizeSiteIdentity("http://127.0.0.1:8080")).toBe("Localhost (8080)");
      expect(normalizeSiteIdentity("mailto:test@example.com")).toBe("Email (test@example.com)");
      expect(normalizeSiteIdentity("chrome://bookmarks")).toBe("Chrome Bookmarks");
    });

    it("gracefully falls back on malformed URLs", () => {
      expect(normalizeSiteIdentity("not-a-valid-url")).toBe("Not A Valid Url");
      expect(normalizeSiteIdentity("")).toBe("Bookmark");
    });
  });

  describe("recoverBookmarkTitle", () => {
    it("preserves valid user titles 100%", () => {
      expect(recoverBookmarkTitle("React Documentation", "https://react.dev")).toBe("React Documentation");
      expect(recoverBookmarkTitle("Deep Learning Paper", "https://arxiv.org/abs/123")).toBe("Deep Learning Paper");
      expect(recoverBookmarkTitle("My Custom YouTube Playlist", "https://youtube.com")).toBe("My Custom YouTube Playlist");
    });

    it("recovers clean brand names when title is empty or missing", () => {
      expect(recoverBookmarkTitle("", "https://www.youtube.com/watch?v=123")).toBe("YouTube");
      expect(recoverBookmarkTitle(null, "https://github.com/memodlike")).toBe("GitHub");
      expect(recoverBookmarkTitle("   ", "https://notion.so")).toBe("Notion");
      expect(recoverBookmarkTitle(undefined, "https://figma.com")).toBe("Figma");
    });

    it("replaces raw URL titles with clean site identities", () => {
      expect(recoverBookmarkTitle("https://www.youtube.com/watch?v=123", "https://www.youtube.com/watch?v=123")).toBe("YouTube");
      expect(recoverBookmarkTitle("www.youtube.com", "https://www.youtube.com")).toBe("YouTube");
      expect(recoverBookmarkTitle("github.com", "https://github.com")).toBe("GitHub");
      expect(recoverBookmarkTitle("https://docs.google.com/document/d/abc", "https://docs.google.com/document/d/abc")).toBe("Google Docs");
      expect(recoverBookmarkTitle("www.example.kz", "https://www.example.kz")).toBe("Example");
      expect(recoverBookmarkTitle("http://localhost:3000", "http://localhost:3000")).toBe("Localhost (3000)");
    });
  });
});
