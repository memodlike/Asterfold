import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { AsterfoldDatabase } from "../src/db/database";
import { createDefaultSettings } from "../src/db/defaults";
import { ensureStarterWorkspace } from "../src/db/repository";
import { IMPORT_LIMITS } from "../src/domain/importLimits";
import { getThemePreset } from "../src/domain/themes";
import { flattenChromeBookmarks } from "../src/features/onboarding/chromeBookmarkImport";
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_STEPS,
  backupPreview,
  canContinue,
  greetingPeriod,
  nextStep,
  previousStep,
  recordPreview,
  shouldShowOnboarding,
  stepIndex,
  type OnboardingPlan,
} from "../src/features/onboarding/onboardingState";
import { createBackup } from "../src/services/exportImport";

function plan(): OnboardingPlan {
  return {
    locale: "en",
    source: "default",
    records: [],
    backup: null,
    preview: null,
    duplicateStrategy: "skip",
    importPageTitle: "Imported bookmarks",
    theme: getThemePreset("frost-light"),
    workspaceLayoutMode: "auto",
    workspaceRows: 2,
  };
}

describe("onboarding lifecycle and state", () => {
  it("marks fresh 3.2.0 settings as pending current onboarding", () => {
    const settings = createDefaultSettings();
    expect(settings.onboardingVersion).toBe(CURRENT_ONBOARDING_VERSION);
    expect(settings.onboardingComplete).toBe(false);
    expect(shouldShowOnboarding(settings)).toBe(true);
  });

  it("does not show after completion", () => {
    expect(shouldShowOnboarding({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingComplete: true })).toBe(false);
  });

  it("does not treat legacy or malformed lifecycle state as a fresh 3.2.0 installation", () => {
    expect(shouldShowOnboarding({ onboardingVersion: 0, onboardingComplete: false })).toBe(false);
    expect(shouldShowOnboarding({ onboardingComplete: false })).toBe(false);
  });

  it.each([
    [0, "evening"], [4, "evening"], [5, "morning"], [11, "morning"],
    [12, "afternoon"], [17, "afternoon"], [18, "evening"], [23, "evening"],
  ] as const)("maps hour %s to %s", (hour, expected) => {
    expect(greetingPeriod(hour)).toBe(expected);
  });

  it("keeps the four-step order stable", () => {
    expect(ONBOARDING_STEPS).toEqual(["welcome", "import", "appearance", "review"]);
    expect(stepIndex("welcome")).toBe(0);
    expect(stepIndex("review")).toBe(3);
  });

  it("clamps forward and backward navigation", () => {
    expect(previousStep("welcome")).toBe("welcome");
    expect(nextStep("welcome")).toBe("import");
    expect(previousStep("review")).toBe("appearance");
    expect(nextStep("review")).toBe("review");
  });

  it("allows the default source without parsing", () => {
    expect(canContinue("import", plan(), false)).toBe(true);
  });

  it("blocks any step while a parser is active", () => {
    expect(canContinue("welcome", plan(), true)).toBe(false);
    expect(canContinue("import", plan(), true)).toBe(false);
    expect(canContinue("appearance", plan(), true)).toBe(false);
  });

  it("requires validated records and preview for Chrome or HTML", () => {
    const current = plan();
    current.source = "chrome";
    expect(canContinue("import", current, false)).toBe(false);
    current.records = [{ title: "Example", url: "https://example.com", description: null, folderPath: [] }];
    expect(canContinue("import", current, false)).toBe(false);
    current.preview = recordPreview("chrome", "Chrome", current.records);
    expect(canContinue("import", current, false)).toBe(true);
  });

  it("requires both parsed backup and preview for restore", async () => {
    const name = `onboarding-backup-${crypto.randomUUID()}`;
    const database = new AsterfoldDatabase(name);
    try {
      await ensureStarterWorkspace(database);
      const backup = await createBackup({}, database);
      const current = plan();
      current.source = "backup";
      expect(canContinue("import", current, false)).toBe(false);
      current.backup = backup;
      expect(canContinue("import", current, false)).toBe(false);
      current.preview = backupPreview("backup.json", backup, 100);
      expect(canContinue("import", current, false)).toBe(true);
    } finally {
      database.close();
      await Dexie.delete(name);
    }
  });

  it("normalizes bookmark preview counts without retaining duplicate payloads", () => {
    const records = [
      { title: "A", url: "https://a.example", description: null, folderPath: ["One"] },
      { title: "B", url: "https://b.example", description: null, folderPath: ["One"] },
      { title: "C", url: "https://c.example", description: null, folderPath: ["Two", "Child"] },
    ];
    expect(recordPreview("html", "bookmarks.html", records, 512)).toMatchObject({
      source: "html", bookmarks: 3, folders: 2, pages: 1, boards: 2, estimatedBytes: 512, destructive: false,
    });
  });
});

describe("Chrome bookmark normalization", () => {
  it("preserves stable depth-first order and folder paths", () => {
    const nodes = [{
      id: "root", title: "", children: [
        { id: "folder", title: "Work", children: [
          { id: "a", title: "A", url: "https://a.example" },
          { id: "nested", title: "Nested", children: [{ id: "b", title: "B", url: "https://b.example" }] },
        ] },
        { id: "c", title: "C", url: "https://c.example" },
      ],
    }] as unknown as chrome.bookmarks.BookmarkTreeNode[];

    expect(flattenChromeBookmarks(nodes)).toEqual([
      { title: "A", url: "https://a.example", description: null, folderPath: ["Work"] },
      { title: "B", url: "https://b.example", description: null, folderPath: ["Work", "Nested"] },
      { title: "C", url: "https://c.example", description: null, folderPath: [] },
    ]);
  });

  it("uses a safe fallback title and truncates untrusted labels", () => {
    const nodes = [{ id: "root", title: "", children: [{ id: "a", title: "   ", url: "https://example.com" }] }] as unknown as chrome.bookmarks.BookmarkTreeNode[];
    expect(flattenChromeBookmarks(nodes)[0]?.title).toBe("Bookmark");

    const long = "x".repeat(400);
    const longNodes = [{ id: "root", title: long, children: [{ id: "a", title: long, url: "https://example.com" }] }] as unknown as chrome.bookmarks.BookmarkTreeNode[];
    const record = flattenChromeBookmarks(longNodes)[0]!;
    expect(record.title).toHaveLength(240);
    expect(record.folderPath[0]).toHaveLength(240);
  });

  it("handles an empty Chrome tree", () => {
    expect(flattenChromeBookmarks([])).toEqual([]);
    expect(flattenChromeBookmarks([{ id: "root", title: "", children: [] }] as chrome.bookmarks.BookmarkTreeNode[])).toEqual([]);
  });

  it("rejects excessive folder nesting", () => {
    const root: chrome.bookmarks.BookmarkTreeNode = { id: "root", title: "root", children: [] };
    let current = root;
    for (let index = 0; index <= IMPORT_LIMITS.depth + 1; index += 1) {
      const child: chrome.bookmarks.BookmarkTreeNode = { id: String(index), title: `folder-${index}`, children: [] };
      current.children = [child];
      current = child;
    }
    expect(() => flattenChromeBookmarks([root])).toThrow(/nesting is too deep/i);
  });
});
