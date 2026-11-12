/*
 * First-run tips. Finishing the welcome screen asks for them once; Settings can ask again.
 * Kept per browser profile next to the other interface hints, outside the workspace data,
 * so a restored backup never replays them.
 */
const TOUR_KEY = "asterfold:tour:v1";
export const TOUR_EVENT = "asterfold:tour";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readTourPending(): boolean {
  try {
    return storage()?.getItem(TOUR_KEY) === "pending";
  } catch {
    return false;
  }
}

function write(value: "pending" | "done"): void {
  try {
    storage()?.setItem(TOUR_KEY, value);
  } catch {
    // Without storage the tips simply do not come back.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOUR_EVENT));
}

export function requestTour(): void { write("pending"); }
export function completeTour(): void { write("done"); }
