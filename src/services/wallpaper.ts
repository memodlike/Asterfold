import { ValidationError } from "../domain/errors";
import { WALLPAPER_LIMITS } from "../domain/mediaLimits";

export interface WallpaperSourceInfo {
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/avif";
  width: number;
  height: number;
  sourceBytes: number;
}

export interface ProcessedWallpaper extends WallpaperSourceInfo {
  blob: Blob;
  thumbnail: Blob;
  storedBytes: number;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const signature = Array.from(value, (character) => character.charCodeAt(0));
  return bytes.some((_, index) => signature.every((byte, offset) => bytes[index + offset] === byte));
}

export function sniffWallpaperMime(bytes: Uint8Array): WallpaperSourceInfo["mimeType"] | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (String.fromCharCode(...bytes.slice(4, 12)).includes("ftyp") && ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12)))) return "image/avif";
  return null;
}

export async function inspectWallpaperSource(file: Blob): Promise<WallpaperSourceInfo> {
  if (file.size === 0 || file.size > WALLPAPER_LIMITS.sourceBytes) throw new ValidationError("Wallpaper must be between 1 byte and 8 MB");
  const header = file.slice(0, Math.min(file.size, 64 * 1024));
  const buffer = typeof header.arrayBuffer === "function"
    ? await header.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer), { once: true });
      reader.addEventListener("error", () => reject(new ValidationError("Wallpaper header could not be read")), { once: true });
      reader.readAsArrayBuffer(header);
    });
  const bytes = new Uint8Array(buffer);
  const mimeType = sniffWallpaperMime(bytes);
  if (!mimeType) throw new ValidationError("Wallpaper format is not a supported raster image");
  if (file.type !== mimeType) throw new ValidationError("Wallpaper MIME type does not match its file content");
  if ((mimeType === "image/png" && containsAscii(bytes, "acTL")) || (mimeType === "image/webp" && containsAscii(bytes, "ANIM"))) {
    throw new ValidationError("Animated wallpapers are not supported");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ValidationError("Wallpaper image could not be decoded");
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
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await target.convertToBlob({ type: "image/webp", quality });
  if (blob.size === 0) throw new ValidationError("Wallpaper encoding failed");
  return blob;
}

async function encodeWithinLimit(
  bitmap: ImageBitmap,
  initialWidth: number,
  initialHeight: number,
  maxBytes: number,
  initialQuality: number,
  minimumDimension: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  let width = initialWidth;
  let height = initialHeight;
  let quality = initialQuality;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const blob = await renderWebp(bitmap, width, height, quality);
    if (blob.size <= maxBytes) return { blob, width, height };
    if (quality > WALLPAPER_LIMITS.minimumQuality) {
      quality = Math.max(WALLPAPER_LIMITS.minimumQuality, quality - 0.1);
      continue;
    }
    const longest = Math.max(width, height);
    if (longest <= minimumDimension) break;
    const scale = Math.max(minimumDimension / longest, 0.78);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    quality = initialQuality;
  }
  throw new ValidationError("Wallpaper cannot be encoded within the local backup size limit");
}

export async function processWallpaper(file: Blob): Promise<ProcessedWallpaper> {
  const info = await inspectWallpaperSource(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ValidationError("Wallpaper image could not be decoded");
  }
  try {
    const scale = Math.min(1, WALLPAPER_LIMITS.outputDimension / Math.max(info.width, info.height));
    const initialWidth = Math.max(1, Math.round(info.width * scale));
    const initialHeight = Math.max(1, Math.round(info.height * scale));
    const encoded = await encodeWithinLimit(
      bitmap,
      initialWidth,
      initialHeight,
      WALLPAPER_LIMITS.encodedBytes,
      0.82,
      WALLPAPER_LIMITS.minimumOutputDimension,
    );
    const thumbnailScale = Math.min(1, WALLPAPER_LIMITS.thumbnailDimension / Math.max(encoded.width, encoded.height));
    const thumbnailEncoded = await encodeWithinLimit(
      bitmap,
      Math.max(1, Math.round(encoded.width * thumbnailScale)),
      Math.max(1, Math.round(encoded.height * thumbnailScale)),
      WALLPAPER_LIMITS.thumbnailBytes,
      0.7,
      WALLPAPER_LIMITS.minimumThumbnailDimension,
    );
    const storedBytes = encoded.blob.size + thumbnailEncoded.blob.size;
    if (storedBytes > WALLPAPER_LIMITS.aggregateBytes) {
      throw new ValidationError("Wallpaper cannot be encoded within the local backup size limit");
    }
    return {
      ...info,
      mimeType: "image/webp",
      width: encoded.width,
      height: encoded.height,
      blob: encoded.blob,
      thumbnail: thumbnailEncoded.blob,
      storedBytes,
    };
  } finally {
    bitmap.close();
  }
}
