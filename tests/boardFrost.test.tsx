import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyFrost } from "../src/features/appearance/frost";
import { useBoardFrost } from "../src/features/boards/boardFrost";

const COPY = { id: "builtin-aurora", url: "data:image/webp;base64,UklGRgQAAABXRUJQ", aspect: 2 };

function Track({ boards }: { boards: number }) {
  const ref = useBoardFrost();
  return <div ref={ref} className="board-track">{Array.from({ length: boards }, (_, index) => <section key={index} className="board" />)}</div>;
}

describe("board frost alignment", () => {
  let frames: FrameRequestCallback[] = [];
  const flush = (): void => {
    const pending = frames;
    frames = [];
    act(() => { for (const frame of pending) frame(0); });
  };

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
  });
  afterEach(() => {
    applyFrost(document.documentElement, null);
    vi.unstubAllGlobals();
  });

  it("does nothing until a frosted copy exists", () => {
    const { container } = render(<Track boards={2} />);
    flush();
    expect(container.querySelector<HTMLElement>(".board-track")!.style.getPropertyValue("--frost-size")).toBe("");
    expect(frames).toHaveLength(0);
  });

  it("writes the copy's size and every board's offset once, in a single frame", () => {
    const { container, unmount } = render(<Track boards={2} />);
    const track = container.querySelector<HTMLElement>(".board-track")!;
    const boards = [...container.querySelectorAll<HTMLElement>(".board")];
    Object.defineProperty(boards[1]!, "offsetLeft", { configurable: true, value: 320 });
    Object.defineProperty(boards[1]!, "offsetTop", { configurable: true, value: 40 });

    act(() => applyFrost(document.documentElement, COPY));
    expect(frames, "one measurement is queued").toHaveLength(1);
    flush();
    expect(track.style.getPropertyValue("--frost-size")).toBe("1060px 530px");
    expect(track.style.getPropertyValue("--frost-x")).toBe("-30px");
    expect(track.style.getPropertyValue("--frost-y")).toBe("-15px");
    expect(boards[0]!.style.getPropertyValue("--frost-bx")).toBe("0px");
    expect(boards[1]!.style.getPropertyValue("--frost-bx")).toBe("320px");
    expect(boards[1]!.style.getPropertyValue("--frost-by")).toBe("40px");

    // A resize re-measures; unchanged values are not written again.
    const setProperty = vi.spyOn(boards[1]!.style, "setProperty");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 2000 });
    act(() => { window.dispatchEvent(new Event("resize")); });
    flush();
    expect(track.style.getPropertyValue("--frost-size")).toBe("2120px 1060px");
    expect(setProperty).not.toHaveBeenCalled();

    unmount();
    act(() => { window.dispatchEvent(new Event("resize")); });
    expect(frames, "listeners are released with the track").toHaveLength(0);
  });
});
