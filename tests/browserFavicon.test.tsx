import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserFavicon } from "../src/components/BrowserFavicon";

describe("BrowserFavicon component", () => {
  afterEach(cleanup);

  it("renders a deterministic local monogram with uppercase letter and palette color", () => {
    const { container } = render(createElement(BrowserFavicon, {
      url: "https://github.com/facebook/react",
      title: "React",
    }));
    const monogram = container.querySelector(".favicon__monogram");
    expect(monogram).not.toBeNull();
    expect(monogram?.textContent).toBe("G");
    expect(monogram?.getAttribute("style")).toMatch(/background-color:\s*rgb/u);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("suppresses monogram letter in privacy mode and renders neutral globe icon", () => {
    const { container } = render(createElement(BrowserFavicon, {
      url: "https://intranet.example/confidential",
      title: "Confidential",
      privacy: true,
    }));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders custom fallback node in privacy mode when fallback is provided", () => {
    const customFallback = createElement("span", { "data-testid": "private-fallback" }, "P");
    const { container } = render(createElement(BrowserFavicon, {
      url: "https://intranet.example/confidential",
      privacy: true,
      fallback: customFallback,
    }));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(screen.getByTestId("private-fallback")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders local neutral Globe fallback when url is empty or whitespace", () => {
    const { container, rerender } = render(createElement(BrowserFavicon, { url: "" }));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(createElement(BrowserFavicon, { url: "   " }));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(createElement(BrowserFavicon, {}));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders custom fallback node when url is empty and fallback is provided", () => {
    const customFallback = createElement("span", { "data-testid": "empty-fallback" }, "★");
    const { container } = render(createElement(BrowserFavicon, {
      url: "",
      fallback: customFallback,
    }));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(screen.getByTestId("empty-fallback")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("applies custom className to the favicon container", () => {
    const { container } = render(createElement(BrowserFavicon, {
      url: "https://example.com",
      className: "custom-favicon-class",
    }));
    const span = container.querySelector(".favicon");
    expect(span).toHaveClass("custom-favicon-class");
  });

  it("always enforces aria-hidden='true' on the container", () => {
    const { container } = render(createElement(BrowserFavicon, { url: "https://example.com" }));
    const span = container.querySelector(".favicon");
    expect(span?.getAttribute("aria-hidden")).toBe("true");
  });

  it("enforces WCAG AA contrast (>= 4.5:1) for all monogram palette colors against white letter", async () => {
    const { MONOGRAM_PALETTE } = await import("../src/domain/bookmarkNaming");
    const toLinear = (c: number): number => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    for (const color of MONOGRAM_PALETTE) {
      const num = parseInt(color.replace("#", ""), 16);
      const r = ((num >> 16) & 255) / 255;
      const g = ((num >> 8) & 255) / 255;
      const b = (num & 255) / 255;
      const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      const contrastRatio = (1.0 + 0.05) / (lum + 0.05);
      expect(contrastRatio, `Color ${color} contrast ratio ${contrastRatio}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
