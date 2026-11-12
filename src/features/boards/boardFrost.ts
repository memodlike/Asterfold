import { useCallback } from "react";
import { FROST_EVENT, frostGeometry } from "../appearance/frost";

/*
 * Lines the pre-blurred wallpaper copy (see appearance/frost.ts) up behind every board.
 *
 * Each board gets its own offset inside the page (`--frost-bx`, `--frost-by`) and the track
 * carries the size and origin of the stretched copy. CSS does the rest with background-position,
 * so there is no per-frame work: offsets are written when the layout changes (boards added,
 * moved or resized, window resized), at most once per animation frame, and only while the
 * frost is on. Offsets come from offsetLeft/offsetTop, which ignore transforms, so a board
 * being dragged simply carries its piece of frosted glass along.
 */
export function useBoardFrost(): (track: HTMLElement | null) => (() => void) | undefined {
  return useCallback((track: HTMLElement | null) => {
    if (!track) return undefined;
    const root = document.documentElement;
    let frame = 0;
    // Last value written per element and property. An unchanged layout writes nothing, so the
    // style observer below does not wake itself up.
    const written = new WeakMap<HTMLElement, Map<string, string>>();
    const write = (element: HTMLElement, name: string, value: string): void => {
      let values = written.get(element);
      if (!values) written.set(element, values = new Map());
      if (values.get(name) === value) return;
      values.set(name, value);
      element.style.setProperty(name, value);
    };

    const measure = (): void => {
      frame = 0;
      const aspect = Number(root.dataset.frostAspect);
      if (root.dataset.frost !== "on" || !Number.isFinite(aspect) || aspect <= 0) return;
      const geometry = frostGeometry(window.innerWidth, window.innerHeight, aspect, getComputedStyle(root).getPropertyValue("--wallpaper-position") || "center");
      const trackRect = track.getBoundingClientRect();
      const originX = trackRect.left + window.scrollX - track.offsetLeft;
      const originY = trackRect.top + window.scrollY - track.offsetTop;
      const boards = [...track.querySelectorAll<HTMLElement>(":scope > .board")];
      // Read every offset first, then write, so the browser lays the page out once.
      const offsets = boards.map((board) => [Math.round(originX + board.offsetLeft), Math.round(originY + board.offsetTop)] as const);
      write(track, "--frost-size", `${String(geometry.width)}px ${String(geometry.height)}px`);
      write(track, "--frost-x", `${String(geometry.x)}px`);
      write(track, "--frost-y", `${String(geometry.y)}px`);
      boards.forEach((board, index) => {
        const offset = offsets[index]!;
        write(board, "--frost-bx", `${String(offset[0])}px`);
        write(board, "--frost-by", `${String(offset[1])}px`);
      });
    };
    const schedule = (): void => {
      if (root.dataset.frost !== "on") return;
      frame ||= requestAnimationFrame(measure);
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    // A board's inline style changes when it moves to another grid cell. While a board is being
    // dragged its neighbours only shift by transform, which offsets ignore, so nothing is measured.
    const styleObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      if (!track.querySelector(":scope > .board.is-dragging")) schedule();
    });
    const observeBoards = (): void => {
      resizeObserver?.disconnect();
      styleObserver?.disconnect();
      resizeObserver?.observe(track);
      for (const board of track.querySelectorAll<HTMLElement>(":scope > .board")) {
        resizeObserver?.observe(board);
        styleObserver?.observe(board, { attributes: true, attributeFilter: ["style"] });
      }
      schedule();
    };
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(observeBoards);
    mutationObserver?.observe(track, { childList: true });
    observeBoards();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener(FROST_EVENT, schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      styleObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener(FROST_EVENT, schedule);
    };
  }, []);
}
