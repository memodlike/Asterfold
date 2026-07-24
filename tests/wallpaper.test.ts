import { describe, expect, it, vi } from "vitest";
import { inspectWallpaperSource, processWallpaper } from "../src/services/wallpaper";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("wallpaper pipeline", () => {
  it("rejects MIME spoofing before decode", async () => {
    const spoofed = new Blob([pngHeader], { type: "image/jpeg" });
    await expect(inspectWallpaperSource(spoofed)).rejects.toThrow(/does not match/iu);
  });

  it("rejects animated raster sources before decode", async () => {
    const animated = new Blob([pngHeader, new TextEncoder().encode("acTL")], { type: "image/png" });
    await expect(inspectWallpaperSource(animated)).rejects.toThrow(/animated/iu);
  });

  it("reports browser decode failures without retaining a bitmap", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.reject(new Error("decoder failed"))));
    const png = new Blob([pngHeader], { type: "image/png" });
    await expect(inspectWallpaperSource(png)).rejects.toThrow(/could not be decoded/iu);
    vi.unstubAllGlobals();
  });

  it("rejects oversized decoded dimensions and always closes the bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 20_000, height: 20_000, close })));
    const png = new Blob([pngHeader], { type: "image/png" });
    await expect(inspectWallpaperSource(png)).rejects.toThrow(/dimensions/iu);
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("accepts a bounded raster image and reports decoded metadata", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 1920, height: 1080, close })));
    const png = new Blob([pngHeader], { type: "image/png" });
    await expect(inspectWallpaperSource(png)).resolves.toEqual({
      mimeType: "image/png",
      width: 1920,
      height: 1080,
      sourceBytes: 8,
    });
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("downscales and creates an optimized WebP plus thumbnail", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 7680, height: 4320, close })));
    class CanvasMock {
      public constructor(public width: number, public height: number) {}
      public getContext() { return { drawImage: vi.fn() }; }
      public convertToBlob() { return Promise.resolve(new Blob([new Uint8Array(32)], { type: "image/webp" })); }
    }
    vi.stubGlobal("OffscreenCanvas", CanvasMock);
    const processed = await processWallpaper(new Blob([pngHeader], { type: "image/png" }));
    expect(processed).toMatchObject({ mimeType: "image/webp", width: 3840, height: 2160, storedBytes: 64 });
    expect(processed.thumbnail.type).toBe("image/webp");
    expect(close).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
