/*
 * The "rate Asterfold" card. It asks people who already use Asterfold for real, once per release:
 * - it waits for 7 days since the first workspace visit and 5 distinct days of use;
 * - showing it counts as the ask for this version, so it never comes back on the next tab,
 *   whether the person answered "Not now", closed it or just went to a bookmark;
 * - after an ask it stays away until a newer version is installed and 14 more days have passed;
 * - "Rate" ends it for good, and it never asks more than three times in total.
 * Kept per browser profile next to the other interface hints, outside the workspace data,
 * so a restored backup never replays it. Nothing leaves the device.
 */
const REVIEW_KEY = "asterfold:review:v1";
export const REVIEW_EVENT = "asterfold:review";

export const STORE_REVIEW_URL = "https://chromewebstore.google.com/detail/alnapeajnjifldmbifnjahkofgbmeamg/reviews";

const DAY_MS = 86_400_000;
export const REVIEW_RULES = {
  minDaysSinceFirstVisit: 7,
  minActiveDays: 5,
  minBookmarks: 3,
  daysBetweenAsks: 14,
  maxAsks: 3,
} as const;

export interface ReviewState {
  firstSeenAt: number;
  lastActiveDay: string;
  activeDays: number;
  status: "waiting" | "asked" | "rated";
  askedVersion: string | null;
  askedAt: number | null;
  asks: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function dayKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function freshState(now: number): ReviewState {
  return { firstSeenAt: now, lastActiveDay: dayKey(now), activeDays: 1, status: "waiting", askedVersion: null, askedAt: null, asks: 0 };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseReviewState(raw: string | null): ReviewState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ReviewState>;
    if (!isFiniteNumber(value.firstSeenAt) || !isFiniteNumber(value.activeDays) || !isFiniteNumber(value.asks)) return null;
    if (typeof value.lastActiveDay !== "string") return null;
    if (value.status !== "waiting" && value.status !== "asked" && value.status !== "rated") return null;
    return {
      firstSeenAt: value.firstSeenAt,
      lastActiveDay: value.lastActiveDay,
      activeDays: Math.max(0, Math.floor(value.activeDays)),
      status: value.status,
      askedVersion: typeof value.askedVersion === "string" ? value.askedVersion : null,
      askedAt: isFiniteNumber(value.askedAt) ? value.askedAt : null,
      asks: Math.max(0, Math.floor(value.asks)),
    };
  } catch {
    return null;
  }
}

export function readReviewState(): ReviewState | null {
  try {
    return parseReviewState(storage()?.getItem(REVIEW_KEY) ?? null);
  } catch {
    return null;
  }
}

function writeReviewState(state: ReviewState): void {
  try {
    storage()?.setItem(REVIEW_KEY, JSON.stringify(state));
  } catch {
    // Without storage the card simply never appears: recordVisit cannot build up enough days of use.
  }
}

/** Counts one more day of use; several tabs on the same day count once. */
export function nextVisitState(state: ReviewState | null, now: number): ReviewState {
  if (!state) return freshState(now);
  const today = dayKey(now);
  if (state.lastActiveDay === today) return state;
  return { ...state, lastActiveDay: today, activeDays: state.activeDays + 1 };
}

export function recordVisit(now = Date.now()): ReviewState {
  const previous = readReviewState();
  const next = nextVisitState(previous, now);
  if (next !== previous) writeReviewState(next);
  return next;
}

function versionParts(version: string): number[] {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(candidate: string, baseline: string): boolean {
  const a = versionParts(candidate);
  const b = versionParts(baseline);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export function isReviewDue(state: ReviewState | null, version: string, bookmarkCount: number, now: number): boolean {
  if (!state || state.status === "rated") return false;
  if (state.asks >= REVIEW_RULES.maxAsks) return false;
  if (bookmarkCount < REVIEW_RULES.minBookmarks) return false;
  if (now - state.firstSeenAt < REVIEW_RULES.minDaysSinceFirstVisit * DAY_MS) return false;
  if (state.activeDays < REVIEW_RULES.minActiveDays) return false;
  if (state.status === "asked") {
    if (!state.askedVersion || !isNewerVersion(version, state.askedVersion)) return false;
    if (state.askedAt === null || now - state.askedAt < REVIEW_RULES.daysBetweenAsks * DAY_MS) return false;
  }
  return true;
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REVIEW_EVENT));
}

/** Showing the card is the ask for this version: it does not return on the next tab. */
export function markReviewAsked(version: string, now = Date.now()): void {
  const state = readReviewState() ?? freshState(now);
  writeReviewState({ ...state, status: "asked", askedVersion: version, askedAt: now, asks: state.asks + 1 });
  notify();
}

export function markReviewRated(now = Date.now()): void {
  const state = readReviewState() ?? freshState(now);
  writeReviewState({ ...state, status: "rated" });
  notify();
}

export function currentExtensionVersion(): string {
  try {
    return globalThis.chrome?.runtime?.getManifest?.().version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const REVIEW_STORAGE_KEY = REVIEW_KEY;
