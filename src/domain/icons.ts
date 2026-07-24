const MAX_CUSTOM_ICON_BYTES = 128 * 1024;
const RASTER_DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/u;

function hasRasterSignature(bytes: Uint8Array, format: string): boolean {
  if (format === "png") {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  if (format === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function safeCustomIconUrl(value: string | null | undefined): string {
  if (!value) return "";
  const match = RASTER_DATA_URL.exec(value);
  if (!match) return "";
  const format = match[1];
  const encoded = match[2];
  if (!format || !encoded || encoded.length > Math.ceil(MAX_CUSTOM_ICON_BYTES * 4 / 3) + 4) return "";
  try {
    const decoded = atob(encoded);
    if (decoded.length === 0 || decoded.length > MAX_CUSTOM_ICON_BYTES) return "";
    const prefix = Uint8Array.from(decoded.slice(0, 12), (character) => character.charCodeAt(0));
    return hasRasterSignature(prefix, format) ? value : "";
  } catch {
    return "";
  }
}
