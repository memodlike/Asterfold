import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingContextMenu } from "../src/components/FloatingContextMenu";

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({ x: 0, y: 0, top: 0, right: 180, bottom: 120, left: 0, width: 180, height: 120, toJSON: () => ({}) })),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FloatingContextMenu resize placement", () => {
  it("reclamps after a late size change and disconnects its observer", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const view = render(createElement(FloatingContextMenu, {
      label: "Actions",
      point: { x: 300, y: 230 },
      onClose: vi.fn(),
      children: createElement("button", null, "Alpha"),
    }));
    const menu = screen.getByRole("menu", { name: "Actions" });
    expect(observe).toHaveBeenCalledWith(menu);
    expect(menu).toHaveStyle({ left: "132px", top: "112px" });

    let height = 120;
    Object.defineProperty(menu, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({ x: 132, y: 112, top: 112, right: 312, bottom: 112 + height, left: 132, width: 180, height, toJSON: () => ({}) })),
    });

    act(() => { resizeCallback?.([], {} as ResizeObserver); });
    expect(menu).toHaveStyle({ left: "132px", top: "112px" });

    height = 125;
    act(() => { resizeCallback?.([], {} as ResizeObserver); });
    expect(menu).toHaveStyle({ left: "132px", top: "107px" });

    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
