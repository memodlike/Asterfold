import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserFavicon } from "../src/components/BrowserFavicon";
import {
  readSiteIconsEnabled,
  rememberSiteIcon,
  resetSiteIconsForTests,
  siteIconState,
  siteIconUrl,
  writeSiteIconsEnabled,
} from "../src/features/icons/siteIcons";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7S8AAAAASUVORK5CYII=";

function loaded(image: HTMLImageElement, size: number): void {
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: size });
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: size });
  fireEvent.load(image);
}

describe("site icons without permissions", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSiteIconsForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    resetSiteIconsForTests();
  });

  it("only asks real web sites for their own favicon", () => {
    expect(siteIconUrl("https://github.com/anthropics?tab=repos")).toEqual({ host: "github.com", src: "https://github.com/favicon.ico" });
    expect(siteIconUrl("http://Example.COM:8080/a")).toEqual({ host: "example.com:8080", src: "http://example.com:8080/favicon.ico" });
    for (const url of ["chrome://bookmarks/", "file:///C:/a.html", "mailto:a@example.com", "https://localhost/", "https://192.168.0.1/", "https://[::1]/", "https://user:pass@example.com/", "not a url", ""]) {
      expect(siteIconUrl(url), url).toBeNull();
    }
  });

  it("is on by default, follows the switch and survives a reload", () => {
    expect(readSiteIconsEnabled()).toBe(true);
    writeSiteIconsEnabled(false);
    expect(readSiteIconsEnabled()).toBe(false);
    expect(localStorage.getItem("asterfold:site-icons:v1")).toBe("off");
    writeSiteIconsEnabled(true);
    expect(readSiteIconsEnabled()).toBe(true);
  });

  it("remembers which sites have an icon and forgets stale answers", () => {
    vi.useFakeTimers();
    const now = Date.now();
    expect(siteIconState("a.example", now)).toBe("unknown");
    rememberSiteIcon("a.example", "miss", now);
    rememberSiteIcon("b.example", "hit", now);
    rememberSiteIcon("b.example", "hit", now);
    expect(siteIconState("a.example", now)).toBe("miss");
    expect(siteIconState("b.example", now)).toBe("hit");
    vi.advanceTimersByTime(700);
    const stored = JSON.parse(localStorage.getItem("asterfold:site-icon-hosts:v1")!) as { hit: Record<string, number>; miss: Record<string, number> };
    expect(Object.keys(stored.hit)).toEqual(["b.example"]);
    expect(Object.keys(stored.miss)).toEqual(["a.example"]);

    resetSiteIconsForTests();
    expect(siteIconState("a.example", now + 4 * 24 * 60 * 60 * 1000), "a miss is retried after three days").toBe("unknown");
    resetSiteIconsForTests();
    expect(siteIconState("b.example", now + 4 * 24 * 60 * 60 * 1000)).toBe("hit");
    rememberSiteIcon("b.example", "miss", now);
    expect(siteIconState("b.example", now)).toBe("miss");

    localStorage.setItem("asterfold:site-icon-hosts:v1", "{broken");
    resetSiteIconsForTests();
    expect(siteIconState("b.example", now)).toBe("unknown");
  });

  it("keeps the letter until the site icon has loaded, then shows only the icon", () => {
    const { container } = render(<BrowserFavicon url="https://github.com/" title="GitHub" />);
    const image = container.querySelector<HTMLImageElement>("img")!;
    expect(image).toHaveAttribute("src", "https://github.com/favicon.ico");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).not.toHaveClass("is-loaded");
    expect(container.querySelector(".favicon__monogram")).toHaveTextContent("G");

    loaded(image, 32);
    expect(container.querySelector(".favicon__monogram")).toBeNull();
    expect(container.querySelector("img")).toHaveClass("is-loaded");
    expect(siteIconState("github.com")).toBe("hit");
  });

  it("falls back to the letter when a site has no icon and does not ask again", () => {
    const first = render(<BrowserFavicon url="https://no-icon.example/" title="Nothing" />);
    fireEvent.error(first.container.querySelector("img")!);
    expect(first.container.querySelector("img")).toBeNull();
    expect(first.container.querySelector(".favicon__monogram")).toHaveTextContent("N");
    first.unmount();

    const second = render(<BrowserFavicon url="https://no-icon.example/other" title="Nothing" />);
    expect(second.container.querySelector("img")).toBeNull();
    second.unmount();

    const tiny = render(<BrowserFavicon url="https://pixel.example/" title="Pixel" />);
    loaded(tiny.container.querySelector<HTMLImageElement>("img")!, 1);
    expect(tiny.container.querySelector("img"), "a 1×1 placeholder is not an icon").toBeNull();
    expect(siteIconState("pixel.example")).toBe("miss");
  });

  it("makes no request when switched off, in privacy mode, for local-only previews or non-web links", () => {
    writeSiteIconsEnabled(false);
    const off = render(<BrowserFavicon url="https://github.com/" title="GitHub" />);
    expect(off.container.querySelector("img")).toBeNull();
    expect(off.container.querySelector(".favicon__monogram")).not.toBeNull();
    act(() => writeSiteIconsEnabled(true));
    expect(off.container.querySelector("img"), "the switch applies live").not.toBeNull();
    off.unmount();

    const hidden = render(<BrowserFavicon url="https://github.com/" title="GitHub" icon={PNG} privacy />);
    expect(hidden.container.querySelector("img")).toBeNull();
    expect(hidden.container.querySelector("svg")).not.toBeNull();
    hidden.unmount();

    const typing = render(<BrowserFavicon url="https://gith" title="" remote={false} />);
    expect(typing.container.querySelector("img")).toBeNull();
    typing.unmount();

    const local = render(<BrowserFavicon url="chrome://settings/" title="Settings" />);
    expect(local.container.querySelector("img")).toBeNull();
    expect(local.container.querySelector(".favicon__monogram")).not.toBeNull();
  });

  it("shows an icon stored with the bookmark without touching the network", () => {
    writeSiteIconsEnabled(false);
    const { container } = render(<BrowserFavicon url="https://github.com/" title="GitHub" icon={PNG} />);
    expect(container.querySelector("img")).toHaveAttribute("src", PNG);
    expect(container.querySelector(".favicon__monogram")).toBeNull();

    const unsafe = render(<BrowserFavicon url="https://github.com/" title="GitHub" icon="https://tracker.invalid/pixel.png" />);
    expect(unsafe.container.querySelector("img")).toBeNull();
    expect(unsafe.container.querySelector(".favicon__monogram")).toHaveTextContent("G");
  });
});
