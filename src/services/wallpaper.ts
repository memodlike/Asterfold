import { ValidationError } from "../domain/errors";
import { WALLPAPER_LIMITS } from "../domain/mediaLimits";
import { sniffWallpaperMime, type WallpaperMimeType } from "../domain/wallpaperFormats";

export interface WallpaperSourceInfo {
  mimeType: WallpaperMimeType;
  width: number;
  height: number;
  sourceBytes: number;
}

export interface ProcessedWallpaper extends WallpaperSourceInfo {
  blob: Blob;
  thumbnail: Blob;
  storedBytes: number;
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const signature = Array.from(value, (character) => character.charCodeAt(0));
  return bytes.some((_, index) => signature.every((byte, offset) => bytes[index + offset] === byte));
}

async function readHeader(file: Blob): Promise<Uint8Array> {
  const header = file.slice(0, Math.min(file.size, 64 * 1024));
  const buffer = typeof header.arrayBuffer === "function"
    ? await header.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer), { once: true });
      reader.addEventListener("error", () => reject(new ValidationError("Wallpaper header could not be read")), { once: true });
      reader.readAsArrayBuffer(header);
    });
  return new Uint8Array(buffer);
}

export { sniffWallpaperMime };

export async function inspectWallpaperSource(file: Blob): Promise<WallpaperSourceInfo> {
  if (file.size === 0 || file.size > WALLPAPER_LIMITS.sourceBytes) {
    throw new ValidationError(`Wallpaper must be between 1 byte and ${WALLPAPER_LIMITS.sourceBytes / 1024 / 1024} MB`);
  }
  const bytes = await readHeader(file);
  const mimeType = sniffWallpaperMime(bytes);
  if (!mimeType) throw new ValidationError("Wallpaper format is not a supported raster image");
  if ((mimeType === "image/png" && containsAscii(bytes, "acTL")) || (mimeType === "image/webp" && containsAscii(bytes, "ANIM"))) {
    throw new ValidationError("Animated PNG and WebP wallpapers are not supported");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ValidationError("Wallpaper image could not be decoded by Chrome");
  }
  try {
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > WALLPAPER_LIMITS.sourceDimension || bitmap.height > WALLPAPER_LIMITS.sourceDimension || bitmap.width * bitmap.height > WALLPAPER_LIMITS.sourcePixels) {
      throw new ValidationError("Wallpaper dimensions are too large");
    }
    return { mimeType, width: bitmap.width, height: bitmap.height, sourceBytes: file.size };
  } finally {
    bitmap.close();
  }
}

function canvas(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas === "undefined") throw new ValidationError("Wallpaper processing is unavailable in this browser");
  return new OffscreenCanvas(width, height);
}

async function renderWebp(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const target = canvas(width, height);
  const context = target.getContext("2d", { alpha: false });
  if (!context) throw new ValidationError("Wallpaper canvas could not be created");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await target.convertToBlob({ type: "image/webp", quality });
  if (blob.size === 0) throw new ValidationError("Wallpaper compatibility encoding failed");
  return blob;
}

async function encodeCompatibilityVariant(
  bitmap: ImageBitmap,
  initialWidth: number,
  initialHeight: number,
): Promise<Blob> {
  let width = initialWidth;
  let height = initialHeight;
  let quality = 0.94;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const blob = await renderWebp(bitmap, width, height, quality);
    if (blob.size <= WALLPAPER_LIMITS.thumbnailBytes) return blob;
    if (quality > WALLPAPER_LIMITS.minimumQuality) {
      quality = Math.max(WALLPAPER_LIMITS.minimumQuality, quality - 0.04);
      continue;
    }
    const longest = Math.max(width, height);
    if (longest <= WALLPAPER_LIMITS.minimumOutputDimension) break;
    const scale = Math.max(WALLPAPER_LIMITS.minimumOutputDimension / longest, 0.88);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    quality = 0.94;
  }
  throw new ValidationError("Wallpaper compatibility copy cannot fit within the local storage safety limit");
}

export async function processWallpaper(file: Blob): Promise<ProcessedWallpaper> {
  const info = await inspectWallpaperSource(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ValidationError("Wallpaper image could not be decoded by Chrome");
  }
  try {
    const scale = Math.min(1, WALLPAPER_LIMITS.outputDimension / Math.max(info.width, info.height));
    const compatibilityWidth = Math.max(1, Math.round(info.width * scale));
    const compatibilityHeight = Math.max(1, Math.round(info.height * scale));
    const compatibility = await encodeCompatibilityVariant(bitmap, compatibilityWidth, compatibilityHeight);
    const original = file.slice(0, file.size, info.mimeType);
    const storedBytes = original.size + compatibility.size;
    if (storedBytes > WALLPAPER_LIMITS.aggregateBytes) {
      throw new ValidationError("Wallpaper exceeds the local storage safety limit");
    }
    return {
      ...info,
      blob: original,
      thumbnail: compatibility,
      storedBytes,
    };
  } finally {
    bitmap.close();
  }
}
