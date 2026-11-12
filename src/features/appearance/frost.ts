/*
 * Frosted glass without live blur.
 *
 * `backdrop-filter` re-blurs the page behind every glass surface on each repaint, which is what
 * makes old integrated graphics and software rasterizers stutter. In the Smooth glass and
 * Lightweight tiers the boards instead paint a tiny copy of the wallpaper that was blurred
 * once (96×60 px, a few kilobytes) and stretched under their tint. Stretching a bitmap is the
 * cheapest thing a compositor does, so the boards look frosted on any machine and cost nothing
 * per frame. The copy is cached per wallpaper, so later tabs apply it before the first paint.
 *
 * Only a wallpaper needs this: flat colours and gradients look the same blurred.
 */

export interface FrostEntry {
  /** Wallpaper the copy was made from. */
  id: string;
  /** `data:image/webp;base64,…` of the blurred copy. */
  url: string;
  /** Width / height of the source wallpaper, used to line the copy up with the real one. */
  aspect: number;
}

export const FROST_CACHE_KEY = "asterfold:frost:v1";
export const FROST_EVENT = "asterfold:frost";

const FROST_WIDTH = 96;
const FROST_HEIGHT = 60;
const MAX_DATA_URL_LENGTH = 48_000;
const SAFE_FROST_URL = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/u;

function validEntry(value: unknown): FrostEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<FrostEntry>;
  if (typeof entry.id !== "string" || entry.id.length === 0 || entry.id.length > 128) return null;
  if (typeof entry.url !== "string" || entry.url.length > MAX_DATA_URL_LENGTH || !SAFE_FROST_URL.test(entry.url)) return null;
  if (typeof entry.aspect !== "number" || !Number.isFinite(entry.aspect) || entry.aspect < 0.2 || entry.aspect > 8) return null;
  return { id: entry.id, url: entry.url, aspect: entry.aspect };
}

export function readFrost(id: string, storage: Pick<Storage, "getItem"> | null = safeStorage()): FrostEntry | null {
  try {
    const entry = validEntry(JSON.parse(storage?.getItem(FROST_CACHE_KEY) ?? "null"));
    return entry && entry.id === id ? entry : null;
  } catch {
    return null;
  }
}

export function storeFrost(entry: FrostEntry, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(FROST_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // The cache only saves regenerating the copy on the next tab.
  }
}

/** Blurs an image the page may already read (an extension asset or a local blob URL) into a small copy. */
export async function buildFrost(id: string, imageUrl: string): Promise<FrostEntry | null> {
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = imageUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = FROST_WIDTH;
    canvas.height = FROST_HEIGHT;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    // Downscale first: the scale-down is most of the blur. The filter softens what is left and
    // lifts saturation the way live glass does. Drawing past the edges keeps them opaque.
    context.filter = "blur(2.5px) saturate(1.45)";
    context.drawImage(image, -6, -6, FROST_WIDTH + 12, FROST_HEIGHT + 12);
    const url = canvas.toDataURL("image/webp", 0.82);
    return validEntry({ id, url, aspect: image.naturalWidth / image.naturalHeight });
  } catch {
    return null;
  }
}

/** Publishes the copy to CSS (or removes it) and tells the board layout to line it up. */
export function applyFrost(root: HTMLElement, entry: FrostEntry | null): void {
  if (entry) {
    root.style.setProperty("--frost-image", `url("${entry.url}")`);
    root.dataset.frost = "on";
    root.dataset.frostAspect = String(entry.aspect);
  } else {
    root.style.removeProperty("--frost-image");
    delete root.dataset.frost;
    delete root.dataset.frostAspect;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FROST_EVENT));
}

export interface FrostGeometry { width: number; height: number; x: number; y: number }

function positionShare(token: string | undefined, fallback: number): number {
  if (!token) return fallback;
  if (token === "left" || token === "top") return 0;
  if (token === "right" || token === "bottom") return 1;
  if (token === "center") return 0.5;
  const percent = /^(-?\d+(?:\.\d+)?)%$/u.exec(token);
  return percent ? Math.max(0, Math.min(1, Number(percent[1]) / 100)) : fallback;
}

/**
 * Where the stretched copy sits in viewport pixels so that it overlaps the real wallpaper,
 * which covers a box 3% larger than the viewport on every side (see `.wallpaper`).
 */
export function frostGeometry(viewportWidth: number, viewportHeight: number, aspect: number, position = "center"): FrostGeometry {
  const boxWidth = viewportWidth * 1.06;
  const boxHeight = viewportHeight * 1.06;
  const width = Math.max(boxWidth, boxHeight * aspect);
  const height = width / aspect;
  const tokens = position.trim().toLowerCase().split(/\s+/u);
  const vertical = tokens.find((token) => token === "top" || token === "bottom");
  const horizontal = tokens.find((token) => token === "left" || token === "right");
  const shareX = horizontal ? positionShare(horizontal, 0.5) : positionShare(vertical ? undefined : tokens[0], 0.5);
  const shareY = vertical ? positionShare(vertical, 0.5) : positionShare(horizontal ? undefined : tokens[1], 0.5);
  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(-viewportWidth * 0.03 + (boxWidth - width) * shareX),
    y: Math.round(-viewportHeight * 0.03 + (boxHeight - height) * shareY),
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
