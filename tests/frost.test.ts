import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFrost, buildFrost, FROST_CACHE_KEY, FROST_EVENT, frostGeometry, readFrost, storeFrost } from "../src/features/appearance/frost";

const URL_OK = "data:image/webp;base64,UklGRgQAAABXRUJQ";

describe("frosted boards without live blur", () => {
  afterEach(() => {
    localStorage.clear();
    applyFrost(document.documentElement, null);
    vi.unstubAllGlobals();
  });

  it("caches one validated copy per wallpaper", () => {
    expect(readFrost("builtin-aurora")).toBeNull();
    storeFrost({ id: "builtin-aurora", url: URL_OK, aspect: 1.6 });
    expect(readFrost("builtin-aurora")).toEqual({ id: "builtin-aurora", url: URL_OK, aspect: 1.6 });
    expect(readFrost("builtin-dusk"), "another wallpaper never reuses the copy").toBeNull();

    for (const bad of [
      { id: "x", url: "https://tracker.invalid/a.webp", aspect: 1.6 },
      { id: "x", url: "data:text/html;base64,PGI+", aspect: 1.6 },
      { id: "x", url: `data:image/webp;base64,${"A".repeat(60_000)}`, aspect: 1.6 },
      { id: "x", url: URL_OK, aspect: 0 },
      { id: "", url: URL_OK, aspect: 1.6 },
      "nonsense",
    ]) {
      localStorage.setItem(FROST_CACHE_KEY, JSON.stringify(bad));
      expect(readFrost("x"), JSON.stringify(bad).slice(0, 60)).toBeNull();
    }
    localStorage.setItem(FROST_CACHE_KEY, "{broken");
    expect(readFrost("x")).toBeNull();
    expect(readFrost("x", null)).toBeNull();
    expect(() => storeFrost({ id: "x", url: URL_OK, aspect: 1 }, { setItem: () => { throw new Error("denied"); } })).not.toThrow();
  });

  it("publishes the copy to CSS, announces it and removes it again", () => {
    const root = document.documentElement;
    const heard = vi.fn();
    window.addEventListener(FROST_EVENT, heard);
    applyFrost(root, { id: "builtin-aurora", url: URL_OK, aspect: 1.6 });
    expect(root.dataset.frost).toBe("on");
    expect(root.dataset.frostAspect).toBe("1.6");
    expect(root.style.getPropertyValue("--frost-image")).toBe(`url("${URL_OK}")`);
    applyFrost(root, null);
    expect(root.dataset.frost).toBeUndefined();
    expect(root.dataset.frostAspect).toBeUndefined();
    expect(root.style.getPropertyValue("--frost-image")).toBe("");
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(FROST_EVENT, heard);
  });

  it("lines the copy up with the real wallpaper, which covers the viewport plus 3% on every side", () => {
    // Same aspect as the box: the copy is exactly the box.
    expect(frostGeometry(1000, 500, 2)).toEqual({ width: 1060, height: 530, x: -30, y: -15 });
    // A taller image is cropped top and bottom, centred by default.
    expect(frostGeometry(1000, 500, 1)).toEqual({ width: 1060, height: 1060, x: -30, y: -280 });
    expect(frostGeometry(1000, 500, 1, "center top").y).toBe(-15);
    expect(frostGeometry(1000, 500, 1, "bottom").y).toBe(-545);
    // A wider image is cropped left and right.
    expect(frostGeometry(1000, 500, 4)).toEqual({ width: 2120, height: 530, x: -560, y: -15 });
    expect(frostGeometry(1000, 500, 4, "left").x).toBe(-30);
    expect(frostGeometry(1000, 500, 4, "right center").x).toBe(-1090);
    expect(frostGeometry(1000, 500, 4, "25% 50%").x).toBe(-295);
    expect(frostGeometry(1000, 500, 4, "nonsense").x).toBe(-560);
  });

  it("blurs the wallpaper once into a small data URL and gives up quietly when it cannot", async () => {
    const drawImage = vi.fn();
    const context = { drawImage, filter: "", imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
    const createElement = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") return createElement(tag);
      return { width: 0, height: 0, getContext: () => context, toDataURL: () => URL_OK } as unknown as HTMLCanvasElement;
    });
    class FakeImage {
      public decoding = "";
      public src = "";
      public naturalWidth = 1920;
      public naturalHeight = 1200;
      public decode(): Promise<void> { return this.src.includes("broken") ? Promise.reject(new Error("decode")) : Promise.resolve(); }
    }
    vi.stubGlobal("Image", FakeImage);

    await expect(buildFrost("builtin-aurora", "/wallpapers/quiet-aurora-compat.webp")).resolves.toEqual({ id: "builtin-aurora", url: URL_OK, aspect: 1.6 });
    expect(context.filter).toContain("blur(");
    expect(drawImage).toHaveBeenCalledTimes(1);
    await expect(buildFrost("x", "/broken.webp")).resolves.toBeNull();
    spy.mockRestore();
  });
});
