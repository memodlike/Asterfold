import { useEffect, useRef } from "react";

const HIT = "data-search-hit";
const CURRENT = "data-search-current";

/**
 * Highlights search matches directly on the boards behind the spotlight.
 *
 * Boards are not re-rendered: matching bookmark nodes get a data attribute that React does not
 * own, written once per animation frame, and <html data-spotlight> dims everything else with a
 * single opacity rule. Cost per keystroke is O(previous hits + new hits), independent of the
 * total number of bookmarks.
 */
export function useBoardHighlights(active: boolean, hitIds: readonly string[], currentId: string | null): void {
  const marked = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const clear = (): void => {
      for (const element of marked.current) {
        element.removeAttribute(HIT);
        element.removeAttribute(CURRENT);
      }
      marked.current = [];
    };
    if (!active) {
      clear();
      delete root.dataset.spotlight;
      return;
    }
    const apply = (): void => {
      clear();
      const next: HTMLElement[] = [];
      for (const id of hitIds) {
        const element = document.querySelector<HTMLElement>(`[data-bookmark-id="${CSS.escape(id)}"]`);
        if (!element) continue;
        element.setAttribute(HIT, "");
        if (id === currentId) element.setAttribute(CURRENT, "");
        next.push(element);
      }
      marked.current = next;
      root.dataset.spotlight = "active";
    };
    if (typeof requestAnimationFrame !== "function") {
      apply();
      return;
    }
    const frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, [active, currentId, hitIds]);

  useEffect(() => () => {
    for (const element of marked.current) {
      element.removeAttribute(HIT);
      element.removeAttribute(CURRENT);
    }
    marked.current = [];
    delete document.documentElement.dataset.spotlight;
  }, []);
}
