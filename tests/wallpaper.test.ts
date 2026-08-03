import { afterEach, describe, expect, it, vi } from "vitest";
import { WALLPAPER_LIMITS } from "../src/domain/mediaLimits";
import { inspectWallpaperSource, processWallpaper, sniffWallpaperMime } from "../src/services/wallpaper";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const webpHeader = new TextEncoder().encode("RIFF0000WEBP");
const avifHeader = new TextEncoder().encode("0000ftypavif0000");
const gifHeader = new TextEncoder().encode("GIF89a");
const bmpHeader = new Uint8Array([0x42, 0x4d, 0x00, 0x00]);
const icoHeader = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);

function decodedBitmap(width: number, height: number, close = vi.fn()): ImageBitmap {
  return { width, height, close } as unknown as ImageBitmap;
}

async function bytes(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("wallpaper pipeline", () => {
  it("recognizes every supported raster signature and rejects unknown bytes", () => {
    expect(sniffWallpaperMime(pngHeader)).toBe("image/png");
    expect(sniffWallpaperMime(jpegHeader)).toBe("image/jpeg");
    expect(sniffWallpaperMime(webpHeader)).toBe("image/webp");
    expect(sniffWallpaperMime(avifHeader)).toBe("image/avif");
    expect(sniffWallpaperMime(gifHeader)).toBe("image/gif");
    expect(sniffWallpaperMime(bmpHeader)).toBe("image/bmp");
    expect(sniffWallpaperMime(icoHeader)).toBe("image/x-icon");
    expect(sniffWallpaperMime(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("rejects empty and oversized sources before decoding", async () => {
    await expect(inspectWallpaperSource(new Blob([]))).rejects.toThrow(/between 1 byte/iu);
    const oversized = { size: WALLPAPER_LIMITS.sourceBytes + 1 } as Blob;
    await expect(inspectWallpaperSource(oversized)).rejects.toThrow(/64 MB/iu);
  });

  it("uses the file signature instead of an unreliable operating-system MIME label", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(decodedBitmap(3840, 2160, close))));
    const genericallyTypedJpeg = new Blob([jpegHeader], { type: "application/octet-stream" });
    await expect(inspectWallpaperSource(genericallyTypedJpeg)).resolves.toEqual({
      mimeType: "image/jpeg",
      width: 3840,
      height: 2160,
      sourceBytes: jpegHeader.length,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects animated PNG and WebP sources before decode", async () => {
    const animatedPng = new Blob([pngHeader, new TextEncoder().encode("acTL")], { type: "image/png" });
    const animatedWebp = new Blob([webpHeader, new TextEncoder().encode("ANIM")], { type: "image/webp" });
    await expect(inspectWallpaperSource(animatedPng)).rejects.toThrow(/animated/iu);
    await expect(inspectWallpaperSource(animatedWebp)).rejects.toThrow(/animated/iu);
  });

  it("reports browser decode failures", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.reject(new Error("decoder failed"))));
    await expect(inspectWallpaperSource(new Blob([pngHeader]))).rejects.toThrow(/could not be decoded by Chrome/iu);
  });

  it("rejects oversized decoded dimensions and always closes the bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(decodedBitmap(20_000, 20_000, close))));
    await expect(inspectWallpaperSource(new Blob([pngHeader]))).rejects.toThrow(/dimensions/iu);
    expect(close).toHaveBeenCalledOnce();
  });

  it("accepts a bounded high-resolution raster and reports original metadata", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(decodedBitmap(7680, 4320, close))));
    const png = new Blob([pngHeader], { type: "" });
    await expect(inspectWallpaperSource(png)).resolves.toEqual({
      mimeType: "image/png",
      width: 7680,
      height: 4320,
      sourceBytes: pngHeader.length,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("preserves the exact original raster and creates a separate Full HD software copy", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(decodedBitmap(7680, 4320, close))));
    const canvasSizes: Array<[number, number]> = [];
    class CanvasMock {
      public constructor(public width: number, public height: number) { canvasSizes.push([width, height]); }
      public getContext() {
        return { imageSmoothingEnabled: false, imageSmoothingQuality: "low", drawImage: vi.fn() };
      }
      public convertToBlob() { return Promise.resolve(new Blob([webpHeader, new Uint8Array(24)], { type: "image/webp" })); }
    }
    vi.stubGlobal("OffscreenCanvas", CanvasMock);
    const sourceBytes = new Uint8Array([...pngHeader, 10, 20, 30, 40]);
    const source = new Blob([sourceBytes], { type: "application/octet-stream" });
    const processed = await processWallpaper(source);

    expect(processed).toMatchObject({
      mimeType: "image/png",
      width: 7680,
      height: 4320,
      sourceBytes: sourceBytes.length,
    });
    expect(processed.blob.type).toBe("image/png");
    expect(processed.blob.size).toBe(source.size);
    expect(await bytes(processed.blob)).toEqual([...sourceBytes]);
    expect(processed.thumbnail.type).toBe("image/webp");
    expect(canvasSizes[0]).toEqual([1920, 1080]);
    expect(processed.storedBytes).toBe(processed.blob.size + processed.thumbnail.size);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("reduces only the software copy quality until it fits its storage limit", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(decodedBitmap(3840, 2160, close))));
    const qualities: number[] = [];
    class CanvasMock {
      public constructor(public width: number, public height: number) {}
      public getContext() { return { imageSmoothingEnabled: false, imageSmoothingQuality: "low", drawImage: vi.fn() }; }
      public convertToBlob(options: { quality?: number }) {
        const quality = options.quality ?? 1;
        qualities.push(quality);
        const size = quality > 0.82 ? 9 * 1024 * 1024 : 512 * 1024;
        return Promise.resolve({ size, type: "image/webp" } as Blob);
      }
    }
    vi.stubGlobal("OffscreenCanvas", CanvasMock);
    const source = new Blob([pngHeader], { type: "image/png" });
    const processed = await processWallpaper(source);
    expect(processed.blob.size).toBe(source.size);
    expect(processed.thumbnail.size).toBeLessThanOrEqual(WALLPAPER_LIMITS.thumbnailBytes);
    expect(Math.min(...qualities)).toBeLessThanOrEqual(0.82);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("rejects a software copy that cannot fit after adaptive quality and resize", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(decodedBitmap(3840, 2160, close))));
    class CanvasMock {
      public constructor(public width: number, public height: number) {}
      public getContext() { return { imageSmoothingEnabled: false, imageSmoothingQuality: "low", drawImage: vi.fn() }; }
      public convertToBlob() { return Promise.resolve({ size: 9 * 1024 * 1024, type: "image/webp" } as Blob); }
    }
    vi.stubGlobal("OffscreenCanvas", CanvasMock);
    await expect(processWallpaper(new Blob([pngHeader]))).rejects.toThrow(/compatibility copy/iu);
    expect(close).toHaveBeenCalledTimes(2);
  });
});
