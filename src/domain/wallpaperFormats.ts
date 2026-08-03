export const WALLPAPER_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/x-icon",
] as const;

export type WallpaperMimeType = typeof WALLPAPER_MIME_TYPES[number];

export const WALLPAPER_FILE_ACCEPT = [
  "image/*",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".bmp",
  ".ico",
].join(",");

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function sniffWallpaperMime(bytes: Uint8Array): WallpaperMimeType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "image/gif";
  if (ascii(bytes, 0, 2) === "BM") return "image/bmp";
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(bytes.length, 64));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }
  return null;
}

export function isWallpaperMimeType(value: string): value is WallpaperMimeType {
  return (WALLPAPER_MIME_TYPES as readonly string[]).includes(value);
}
