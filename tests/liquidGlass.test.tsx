import { StrictMode, useRef } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { activeLiquidGlassCount, createLiquidGlass, mapSize, refractionAllowed, useLiquidGlass } from "../src/features/performance/liquidGlass";

function fakeContext(): Partial<CanvasRenderingContext2D> {
  const gradient = { addColorStop: vi.fn() };
  return {
    createLinearGradient: vi.fn(() => gradient as unknown as CanvasGradient),
    fillRect: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(),
  };
}

function surface(width = 264, height = 290): HTMLDivElement {
  const node = document.createElement("div");
  Object.defineProperty(node, "offsetWidth", { configurable: true, value: width });
  Object.defineProperty(node, "offsetHeight", { configurable: true, value: height });
  document.body.append(node);
  return node;
}

function Probe({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLiquidGlass(ref, active, { scale: -60 });
  return <div ref={(node) => {
    ref.current = node;
    if (node) {
      Object.defineProperty(node, "offsetWidth", { configurable: true, value: 300 });
      Object.defineProperty(node, "offsetHeight", { configurable: true, value: 60 });
    }
  }} className="probe" />;
}

describe("liquid glass refraction", () => {
  beforeEach(() => {
    vi.stubGlobal("CSS", { supports: vi.fn(() => true) });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext() as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA");
    document.documentElement.dataset.performance = "quality";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.performance;
    document.body.replaceChildren();
  });

  it("bounds the displacement map resolution", () => {
    expect(mapSize(680, 60)).toMatchObject({ width: 320, height: 28 });
    expect(mapSize(120, 40)).toMatchObject({ width: 120, height: 40, ratio: 1 });
  });

  it("is allowed only in the resolved Quality tier and without accessibility overrides", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    expect(refractionAllowed()).toBe(true);
    for (const mode of ["balanced", "compatibility", "software"]) {
      document.documentElement.dataset.performance = mode;
      expect(refractionAllowed()).toBe(false);
    }
    document.documentElement.dataset.performance = "quality";
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("reduced-transparency") })));
    expect(refractionAllowed()).toBe(false);
  });

  it("owns its filter node, caps simultaneous surfaces and restores owned state", () => {
    const first = surface();
    first.style.setProperty("--lg-refraction", "none");
    const a = createLiquidGlass(first);
    const b = createLiquidGlass(surface());
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(createLiquidGlass(surface())).toBeNull();
    expect(activeLiquidGlassCount()).toBe(2);
    expect(first.dataset.refraction).toBe("on");
    expect(first.style.getPropertyValue("backdrop-filter")).toBe("");
    const ids = [...document.querySelectorAll("filter")].map((node) => node.id);
    expect(new Set(ids).size).toBe(2);
    expect(document.querySelector("filter")?.getAttribute("color-interpolation-filters")).toBe("sRGB");

    a?.destroy();
    a?.destroy();
    b?.destroy();
    expect(activeLiquidGlassCount()).toBe(0);
    expect(document.querySelectorAll(".liquid-glass-defs")).toHaveLength(0);
    expect(first.style.getPropertyValue("--lg-refraction")).toBe("none");
    expect(first.hasAttribute("data-refraction")).toBe(false);
  });

  it("skips oversized surfaces and unsupported browsers", () => {
    const large = surface(1200, 400);
    const handle = createLiquidGlass(large);
    expect(large.hasAttribute("data-refraction")).toBe(false);
    handle?.destroy();
    vi.stubGlobal("CSS", { supports: vi.fn(() => false) });
    expect(createLiquidGlass(surface())).toBeNull();
  });

  it("survives StrictMode remounts, follows tier changes and cleans up on unmount", async () => {
    const view = render(<StrictMode><Probe active /></StrictMode>);
    const probe = view.container.querySelector<HTMLElement>(".probe");
    expect(probe?.dataset.refraction).toBe("on");
    expect(document.querySelectorAll(".liquid-glass-defs")).toHaveLength(1);

    document.documentElement.dataset.performance = "compatibility";
    await Promise.resolve();
    expect(probe?.hasAttribute("data-refraction")).toBe(false);
    expect(document.querySelectorAll(".liquid-glass-defs")).toHaveLength(0);

    document.documentElement.dataset.performance = "quality";
    await Promise.resolve();
    expect(probe?.dataset.refraction).toBe("on");

    view.rerender(<StrictMode><Probe active={false} /></StrictMode>);
    expect(document.querySelectorAll(".liquid-glass-defs")).toHaveLength(0);
    view.unmount();
    expect(activeLiquidGlassCount()).toBe(0);
  });

  it("keeps the tier CSS as the only place refraction becomes pixels", () => {
    const material = readFileSync(`${process.cwd()}/src/styles/material.css`, "utf8");
    expect(material).toMatch(/@media \(prefers-reduced-transparency: no-preference\) and \(prefers-contrast: no-preference\) and \(forced-colors: none\) \{\s*html\[data-performance="quality"\] \[data-refraction="on"\]/u);
    const source = readFileSync(`${process.cwd()}/src/features/performance/liquidGlass.ts`, "utf8");
    expect(source).not.toMatch(/style\.(webkitB|b)ackdropFilter|innerHTML|insertAdjacentHTML/u);
  });
});
