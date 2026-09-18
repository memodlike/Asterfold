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
});
