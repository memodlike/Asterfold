import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardGlare } from "../src/features/boards/boardGlare";

function Track({ mounted = true }: { mounted?: boolean }) {
  const glareRef = useBoardGlare();
  if (!mounted) return <p>No boards</p>;
  return (
    <div ref={glareRef} className="board-track">
      <section className="board" data-board-id="a"><span className="board__glare" /><p className="inside">A</p></section>
      <section className="board" data-board-id="b"><span className="board__glare" /></section>
    </div>
  );
}

function pointer(target: Element, type: string, init: { x?: number; y?: number; pointerType?: string; buttons?: number } = {}): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: init.x ?? 0, clientY: init.y ?? 0, buttons: init.buttons ?? 0 });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  target.dispatchEvent(event);
}

describe("board pointer highlight", () => {
  let frames: FrameRequestCallback[] = [];
  const flush = (): void => { const pending = frames; frames = []; for (const callback of pending) callback(performance.now()); };

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { frames = []; }));
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 300, height: 200, right: 400, bottom: 250, x: 100, y: 50, toJSON: () => ({}) });
    document.documentElement.dataset.performance = "quality";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.performance;
  });

  it("moves only the highlight layer, at most once per frame, and never the board", () => {
    const view = render(<Track />);
    const board = view.container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    const layer = board.querySelector<HTMLElement>(".board__glare")!;
    pointer(board.querySelector(".inside")!, "pointermove", { x: 130, y: 90 });
    pointer(board, "pointermove", { x: 160, y: 120 });
    expect(frames).toHaveLength(1);
    expect(board).toHaveClass("is-lit");
    flush();
    expect(layer.style.transform).toBe("translate3d(60px, 70px, 0)");
    expect(board.style.transform).toBe("");

    const other = view.container.querySelector<HTMLElement>('[data-board-id="b"]')!;
    pointer(other, "pointermove", { x: 110, y: 60 });
    expect(board).not.toHaveClass("is-lit");
    expect(other).toHaveClass("is-lit");

    pointer(view.container.querySelector(".board-track")!, "pointerleave");
    expect(other).not.toHaveClass("is-lit");
  });

  it("stays off for touch, pressed buttons, the lightweight tier and reduced motion", () => {
    const view = render(<Track />);
    const board = view.container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    pointer(board, "pointermove", { pointerType: "touch" });
    pointer(board, "pointermove", { buttons: 1 });
    document.documentElement.dataset.performance = "software";
    pointer(board, "pointermove");
    document.documentElement.dataset.performance = "quality";
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    view.unmount();
    const reduced = render(<Track />);
    pointer(reduced.container.querySelector('[data-board-id="a"]')!, "pointermove");
    expect(frames).toHaveLength(0);
    expect(document.querySelectorAll(".is-lit")).toHaveLength(0);
  });

  it("attaches to a board track that appears after the first render", () => {
    const view = render(<Track mounted={false} />);
    view.rerender(<Track />);
    const board = view.container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    pointer(board, "pointermove", { x: 130, y: 90 });
    expect(board).toHaveClass("is-lit");
  });

  it("puts the highlight out when the page scrolls or resizes under a still pointer", () => {
    const view = render(<Track />);
    const board = view.container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    pointer(board, "pointermove", { x: 130, y: 90 });
    window.dispatchEvent(new Event("scroll"));
    expect(board).not.toHaveClass("is-lit");
    pointer(board, "pointermove", { x: 130, y: 90 });
    window.dispatchEvent(new Event("resize"));
    expect(board).not.toHaveClass("is-lit");
  });

  it("cancels the pending frame and drops listeners on unmount", () => {
    const view = render(<Track />);
    const board = view.container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    pointer(board, "pointermove", { x: 120, y: 80 });
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(board).not.toHaveClass("is-lit");
    pointer(board, "pointermove", { x: 140, y: 80 });
    expect(frames).toHaveLength(0);
  });
});
