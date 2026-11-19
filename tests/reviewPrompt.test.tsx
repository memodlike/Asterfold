import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  isNewerVersion,
  isReviewDue,
  markReviewAsked,
  markReviewRated,
  nextVisitState,
  parseReviewState,
  readReviewState,
  recordVisit,
  REVIEW_RULES,
  REVIEW_STORAGE_KEY,
  STORE_REVIEW_URL,
  type ReviewState,
} from "../src/features/review/reviewPrompt";
import { ReviewNudge, REVIEW_SHOW_DELAY_MS } from "../src/features/review/ReviewNudge";

const openUrl = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
vi.mock("../src/browser/api", () => ({ openUrl }));

const DAY = 86_400_000;
const START = new Date(2026, 10, 1, 10).getTime();

function used(days: number, extra: Partial<ReviewState> = {}): ReviewState {
  return { firstSeenAt: START, lastActiveDay: "x", activeDays: days, status: "waiting", askedVersion: null, askedAt: null, asks: 0, ...extra };
}

describe("review prompt rules", () => {
  beforeEach(() => localStorage.clear());

  it("waits for a week, five days of use and a few bookmarks", () => {
    const later = START + 8 * DAY;
    expect(isReviewDue(used(5), "3.9.2", 10, later)).toBe(true);
    expect(isReviewDue(used(5), "3.9.2", 10, START + 6 * DAY)).toBe(false);
    expect(isReviewDue(used(4), "3.9.2", 10, later)).toBe(false);
    expect(isReviewDue(used(5), "3.9.2", REVIEW_RULES.minBookmarks - 1, later)).toBe(false);
    expect(isReviewDue(null, "3.9.2", 10, later)).toBe(false);
  });

  it("counts several tabs on one day as a single day of use", () => {
    const first = nextVisitState(null, START);
    expect(first.activeDays).toBe(1);
    expect(nextVisitState(first, START + 3_600_000)).toBe(first);
    expect(nextVisitState(first, START + DAY).activeDays).toBe(2);
  });

  it("never asks again after Rate", () => {
    expect(isReviewDue(used(30, { status: "rated" }), "9.0.0", 50, START + 400 * DAY)).toBe(false);
  });

  it("after an ask, comes back only for a newer version and after two weeks", () => {
    const asked = used(30, { status: "asked", askedVersion: "3.9.2", askedAt: START + 10 * DAY, asks: 1 });
    expect(isReviewDue(asked, "3.9.2", 50, START + 60 * DAY)).toBe(false);
    expect(isReviewDue(asked, "3.9.1", 50, START + 60 * DAY)).toBe(false);
    expect(isReviewDue(asked, "3.10.0", 50, START + 20 * DAY)).toBe(false);
    expect(isReviewDue(asked, "3.10.0", 50, START + 25 * DAY)).toBe(true);
  });

  it("stops after three asks in total", () => {
    const asked = used(90, { status: "asked", askedVersion: "3.9.2", askedAt: START, asks: REVIEW_RULES.maxAsks });
    expect(isReviewDue(asked, "4.0.0", 50, START + 300 * DAY)).toBe(false);
  });

  it("compares versions numerically", () => {
    expect(isNewerVersion("3.10.0", "3.9.2")).toBe(true);
    expect(isNewerVersion("3.9.2", "3.9.2")).toBe(false);
    expect(isNewerVersion("3.9.1", "3.9.2")).toBe(false);
    expect(isNewerVersion("4", "3.99.99")).toBe(true);
  });

  it("stores state per profile and ignores damaged values", () => {
    recordVisit(START);
    markReviewAsked("3.9.2", START + DAY);
    expect(readReviewState()).toMatchObject({ status: "asked", askedVersion: "3.9.2", asks: 1 });
    markReviewRated(START + 2 * DAY);
    expect(readReviewState()?.status).toBe("rated");
    localStorage.setItem(REVIEW_STORAGE_KEY, "{broken");
    expect(readReviewState()).toBeNull();
    expect(parseReviewState(JSON.stringify({ ...used(1), status: "spam" }))).toBeNull();
  });

  it("points at the Asterfold reviews page in the Chrome Web Store", () => {
    expect(STORE_REVIEW_URL).toBe("https://chromewebstore.google.com/detail/alnapeajnjifldmbifnjahkofgbmeamg/reviews");
  });
});

describe("ReviewNudge card", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    openUrl.mockClear();
    vi.useFakeTimers();
  });

  function mount(allowed = true) {
    const utils = render(<ReviewNudge allowed={allowed} bookmarkCount={10} />);
    act(() => { vi.advanceTimersByTime(REVIEW_SHOW_DELAY_MS + 10); });
    return utils;
  }

  function seedDue(): void {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(used(6, { firstSeenAt: Date.now() - 10 * DAY, lastActiveDay: "old" })));
  }

  it("shows once, records the ask and does not return on the next tab", () => {
    seedDue();
    const first = mount();
    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(readReviewState()?.status).toBe("asked");
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    first.unmount();
    mount();
    expect(screen.queryByRole("complementary")).toBeNull();
    vi.useRealTimers();
  });

  it("Rate opens the store reviews and ends the asks", () => {
    seedDue();
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Rate Asterfold" }));
    expect(openUrl).toHaveBeenCalledWith(STORE_REVIEW_URL, "new-tab");
    expect(readReviewState()?.status).toBe("rated");
    vi.useRealTimers();
  });

  it("waits for a hidden tab to come back before showing", () => {
    seedDue();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    mount();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(readReviewState()?.status).toBe("waiting");
    visibility.mockReturnValue("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { vi.advanceTimersByTime(REVIEW_SHOW_DELAY_MS + 10); });
    expect(screen.getByRole("complementary")).toBeTruthy();
    visibility.mockRestore();
    vi.useRealTimers();
  });

  it("stays hidden while a dialog, tips or Privacy Mode is on screen", () => {
    seedDue();
    mount(false);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(readReviewState()?.status).toBe("waiting");
    vi.useRealTimers();
  });
});
