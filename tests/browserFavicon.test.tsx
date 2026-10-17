import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserFavicon } from "../src/components/BrowserFavicon";

describe("BrowserFavicon component", () => {
  afterEach(cleanup);

  it("renders an img tag for a safe Chrome extension favicon URL", () => {
    const { container } = render(createElement(BrowserFavicon, {
      source: "chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=32",
    }));
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=32");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("role")).toBe("presentation");
    expect(img?.getAttribute("draggable")).toBe("false");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("rejects remote Google S2 favicon URLs without rendering img", () => {
    const { container } = render(createElement(BrowserFavicon, {
      source: "https://www.google.com/s2/favicons?domain=example.com&sz=32",
    }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a deterministic local monogram with uppercase letter and palette color", () => {
    const { container } = render(createElement(BrowserFavicon, {
      url: "https://github.com/facebook/react",
    }));
    expect(container.querySelector("img")).toBeNull();
    const monogram = container.querySelector(".favicon__monogram");
    expect(monogram).not.toBeNull();
    expect(monogram?.textContent).toBe("G");
    expect(monogram?.getAttribute("style")).toMatch(/background-color:\s*rgb/u);
  });

  it("suppresses monogram letter in privacy mode and renders neutral icon", () => {
    const { container } = render(createElement(BrowserFavicon, {
      url: "https://intranet.example/confidential",
      privacy: true,
    }));
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("falls back to local neutral Globe SVG when image fires onError", () => {
    const { container } = render(createElement(BrowserFavicon, {
      source: "chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fmissing.example&size=32",
    }));
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("resets failed state when source prop changes", () => {
    const { container, rerender } = render(createElement(BrowserFavicon, {
      source: "chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Ffirst.example&size=32",
    }));
    const img = container.querySelector("img");
    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(createElement(BrowserFavicon, {
      source: "chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fsecond.example&size=32",
    }));
    const newImg = container.querySelector("img");
    expect(newImg).not.toBeNull();
    expect(newImg?.getAttribute("src")).toContain("second.example");
  });

  it("renders local neutral Globe when source is empty", () => {
    const { container } = render(createElement(BrowserFavicon, { source: "" }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("rejects unsafe remote and non-Chrome URLs without rendering img", () => {
    const unsafeSources = [
      "https://remote.tracker/favicon.ico",
      "http://insecure.site/favicon.png",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg></svg>",
      "file:///etc/passwd",
    ];

    for (const source of unsafeSources) {
      const { container } = render(createElement(BrowserFavicon, { source }));
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg")).not.toBeNull();
      cleanup();
    }
  });

  it("strictly suppresses img and renders neutral icon in privacy mode", () => {
    const { container } = render(createElement(BrowserFavicon, {
      source: "chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fsecret.example&size=32",
      privacy: true,
    }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders custom fallback node when provided and source is missing or failed", () => {
    const customFallback = createElement("span", { "data-testid": "monogram" }, "E");
    const { container, rerender } = render(createElement(BrowserFavicon, {
      source: "",
      fallback: customFallback,
    }));
    expect(screen.getByTestId("monogram")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();

    rerender(createElement(BrowserFavicon, {
      source: "chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=32",
      fallback: customFallback,
    }));
    const img = container.querySelector("img");
    fireEvent.error(img!);
    expect(screen.getByTestId("monogram")).not.toBeNull();
  });

  it("always enforces aria-hidden='true' on the container", () => {
    const { container } = render(createElement(BrowserFavicon, { source: "" }));
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
