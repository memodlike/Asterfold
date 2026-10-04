import { useCallback } from "react";

/*
 * Pointer highlight on glass boards. One delegated listener on the board track, at most one
 * animation frame in flight, and the only per-frame write is the transform of the hovered
 * board's own `.board__glare` layer — no React render, no custom properties, and never the
 * board's transform, which belongs to the drag-and-drop wrapper. Opacity is driven by the
 * `is-lit` class (CSS), so the layer fades in and out only on enter/leave.
 * Off for touch/pen, while a button is held (dragging), in the Lightweight tier and with
 * reduced motion; CSS repeats those gates for the cases JavaScript does not see. Scrolling or
 * resizing under a still pointer puts the light out; the next pointer move relights it.
 * Returned as a callback ref with cleanup (React 19), so it attaches whenever the track mounts —
 * including after an empty page gets its first board — without an extra render.
 */

const LIT = "is-lit";

export function useBoardGlare(): (track: HTMLElement | null) => (() => void) | undefined {
  return useCallback((track: HTMLElement | null) => {
    if (!track) return undefined;
    const reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    let board: HTMLElement | null = null;
    let layer: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const release = (): void => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      board?.classList.remove(LIT);
      board = null;
      layer = null;
      rect = null;
    };
    const paint = (): void => {
      frame = 0;
      if (!layer || !rect) return;
      layer.style.transform = `translate3d(${String(Math.round(x - rect.left))}px, ${String(Math.round(y - rect.top))}px, 0)`;
    };
    const allowed = (event: PointerEvent): boolean =>
      event.pointerType === "mouse"
      && event.buttons === 0
      && document.documentElement.dataset.performance !== "software"
      && !reducedMotion?.matches
      && !track.closest(".motion-disabled");

    const onMove = (event: PointerEvent): void => {
      const next = allowed(event) && event.target instanceof Element ? event.target.closest<HTMLElement>(".board") : null;
      const nextLayer = next && !next.classList.contains("is-dragging") ? next.querySelector<HTMLElement>(".board__glare") : null;
      if (!next || !nextLayer) {
        release();
        return;
      }
      if (next !== board) {
        release();
        board = next;
        layer = nextLayer;
        rect = next.getBoundingClientRect();
        board.classList.add(LIT);
      }
      x = event.clientX;
      y = event.clientY;
      frame ||= requestAnimationFrame(paint);
    };

    track.addEventListener("pointermove", onMove, { passive: true });
    track.addEventListener("pointerleave", release);
    track.addEventListener("pointerdown", release);
    window.addEventListener("scroll", release, { passive: true, capture: true });
    window.addEventListener("resize", release, { passive: true });
    return () => {
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerleave", release);
      track.removeEventListener("pointerdown", release);
      window.removeEventListener("scroll", release, { capture: true });
      window.removeEventListener("resize", release);
      release();
    };
  }, []);
}
