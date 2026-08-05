import { describe, expect, it } from "vitest";
import type { LocalePreference } from "../src/domain/models";
import {
  onboardingText,
  resolveOnboardingLocale,
  type OnboardingMessageKey,
} from "../src/features/onboarding/onboardingMessages";

const locales = ["en", "ru", "kk", "es", "de", "fr", "it", "pt", "pl", "uk", "tr", "nl"] as const satisfies readonly LocalePreference[];
const keys = [
  "greeting.morning", "greeting.afternoon", "greeting.evening", "welcome.title", "welcome.body", "welcome.privacy", "welcome.language",
  "step.welcome", "step.import", "step.appearance", "step.review", "import.title", "import.body", "import.default.title", "import.default.body",
  "import.chrome.title", "import.chrome.body", "import.chrome.permission", "import.chrome.denied", "import.html.title", "import.html.body", "import.backup.title", "import.backup.body",
  "import.preview", "import.empty", "import.parsing", "appearance.title", "appearance.body", "appearance.preset", "appearance.density", "appearance.compact",
  "appearance.comfortable", "appearance.spacious", "appearance.rows", "review.title", "review.body", "review.source", "review.language", "review.theme", "review.layout",
  "review.duplicates", "action.continue", "action.back", "action.finish", "action.finishing", "action.skip", "action.retry", "skip.title", "skip.body", "skip.continue",
  "skip.confirm", "status.ready", "status.error",
] as const satisfies readonly OnboardingMessageKey[];

describe("onboarding localization", () => {
  it.each(locales)("resolves every primary onboarding key for %s", (locale) => {
    for (const key of keys) {
      const value = onboardingText(locale, key, { bookmarks: 2, folders: 1, pages: 1, boards: 1 });
      expect(value.trim(), `${locale}:${key}`).not.toBe("");
      expect(value, `${locale}:${key}`).not.toContain(key);
      expect(value, `${locale}:${key}`).not.toMatch(/\{(?:bookmarks|folders|pages|boards)\}/u);
    }
  });

  it("interpolates preview counts for zero, one and multiple items", () => {
    expect(onboardingText("en", "import.preview", { bookmarks: 0, folders: 0, pages: 0, boards: 0 })).toContain("0 bookmarks");
    expect(onboardingText("en", "import.preview", { bookmarks: 1, folders: 1, pages: 1, boards: 1 })).toContain("1 bookmarks");
    expect(onboardingText("ru", "import.preview", { bookmarks: 12, folders: 3, pages: 1, boards: 3 })).toContain("12");
    expect(onboardingText("kk", "import.preview", { bookmarks: 2, folders: 1, pages: 1, boards: 1 })).toContain("2");
  });

  it("uses the explicit locale immediately without relying on persistent settings", () => {
    expect(onboardingText("en", "welcome.title")).toBe("Welcome to Asterfold");
    expect(onboardingText("ru", "welcome.title")).toBe("Добро пожаловать в Asterfold");
    expect(onboardingText("kk", "welcome.title")).toBe("Asterfold қолданбасына қош келдіңіз");
  });

  it("falls back to English for an unsupported system locale", () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language: "ja-JP" } });
    try {
      expect(resolveOnboardingLocale("auto")).toBe("en");
      expect(onboardingText("auto", "welcome.title")).toBe("Welcome to Asterfold");
    } finally {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
    }
  });
});
