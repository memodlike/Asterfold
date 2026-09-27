import { useEffect, type RefObject } from "react";

/*
 * Edge refraction for a few glass overlays, adapted from the liquid-glass reference
 * (.claude/skills/liquid-glass). Differences that matter here:
 *  - it only exposes a filter reference through --lg-refraction and data-refraction; the
 *    rendering tier in material.css decides whether backdrop-filter uses it, so lower tiers
 *    and accessibility media queries always win over this module;
 *  - every instance owns its <svg> node, and destroy() removes it and restores the owned
 *    style/attribute values, which keeps StrictMode remounts and tier changes leak-free;
 *  - displacement maps are generated at a bounded resolution, only when the element size
 *    changes, never per frame; and no more than MAX_ACTIVE surfaces refract at once;
 *  - there is no blur fallback: unsupported browsers keep the tier's ordinary frosted glass.
 * Maps contain synthetic gradients only, never page or bookmark content.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_ACTIVE = 2;
const MAX_SURFACE_SIDE = 800;
const MAX_MAP_SIDE = 320;
const RESIZE_DEBOUNCE_MS = 120;
const CHANNEL_KEEP = [
  "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
] as const;

export interface LiquidGlassOptions {
  /** Displacement strength; negative values magnify toward the rim. */
  scale?: number | undefined;
  /** Per-channel stagger for the prism fringe; 0 disables it. */
  chroma?: number | undefined;
  /** Neutral inset as a fraction of the shorter side. */
  border?: number | undefined;
  /** Softness (px, at element size) of the rim curvature. */
  mapBlur?: number | undefined;
}

export interface LiquidGlassHandle { destroy: () => void }

let nextId = 0;
let activeCount = 0;

export function activeLiquidGlassCount(): number {
  return activeCount;
}

export function liquidGlassSupported(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "url(#af-lg-probe)");
  } catch {
    return false;
  }
}

/** Map resolution is capped so a large surface never allocates a large canvas. */
export function mapSize(width: number, height: number): { width: number; height: number; ratio: number } {
  const ratio = Math.min(1, MAX_MAP_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)), ratio };
}

function drawMap(width: number, height: number, radius: number, border: number, mapBlur: number): string | null {
  const size = mapSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context || typeof context.roundRect !== "function") return null;
  const w = size.width;
  const h = size.height;
  const horizontal = context.createLinearGradient(0, 0, w, 0);
  horizontal.addColorStop(0, "rgb(0 0 0)");
  horizontal.addColorStop(1, "rgb(255 0 0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, w, h);
  const vertical = context.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, "rgb(0 0 0)");
  vertical.addColorStop(1, "rgb(0 0 255)");
  context.globalCompositeOperation = "difference";
  context.fillStyle = vertical;
  context.fillRect(0, 0, w, h);
  // A blurred neutral-gray inset cancels displacement inside, confining it to the rim.
  context.globalCompositeOperation = "source-over";
  const inset = border * Math.min(w, h);
  context.filter = `blur(${String(Math.max(1, mapBlur * size.ratio))}px)`;
  context.fillStyle = "rgb(128 128 128 / .93)";
  context.beginPath();
  context.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(radius * size.ratio - inset, 2));
  context.fill();
  context.filter = "none";
  return canvas.toDataURL();
}

function element<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function buildFilter(id: string, scales: readonly number[]): { svg: SVGSVGElement; image: SVGFEImageElement } {
  // Zero-sized but rendered: display:none would stop feImage from resolving.
  const svg = element("svg", { width: 0, height: 0, "aria-hidden": "true", focusable: "false", class: "liquid-glass-defs" });
  // The filter must interpolate in sRGB, otherwise the neutral gray reads as a constant offset.
  const filter = element("filter", { id, x: 0, y: 0, width: "100%", height: "100%", "color-interpolation-filters": "sRGB" });
  const image = element("feImage", { x: 0, y: 0, result: "map", preserveAspectRatio: "none" });
  filter.append(image);
  scales.forEach((scale, index) => {
    filter.append(
      element("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale, xChannelSelector: "R", yChannelSelector: "B", result: `d${String(index)}` }),
      element("feColorMatrix", { in: `d${String(index)}`, type: "matrix", values: CHANNEL_KEEP[index] ?? CHANNEL_KEEP[0], result: `c${String(index)}` }),
    );
  });
  filter.append(
    element("feBlend", { in: "c0", in2: "c1", mode: "screen", result: "c01" }),
    element("feBlend", { in: "c01", in2: "c2", mode: "screen" }),
  );
  const defs = element("defs", {});
  defs.append(filter);
  svg.append(defs);
  return { svg, image };
}

function cornerRadius(target: HTMLElement, width: number, height: number): number {
  const raw = getComputedStyle(target).borderTopLeftRadius || "0px";
  const value = Number.parseFloat(raw) || 0;
  return raw.trim().endsWith("%") ? value / 100 * Math.min(width, height) : value;
}

/** Returns null when unsupported or when the simultaneous-surface budget is spent. */
export function createLiquidGlass(target: HTMLElement, options: LiquidGlassOptions = {}): LiquidGlassHandle | null {
  if (activeCount >= MAX_ACTIVE || !liquidGlassSupported()) return null;
  const { scale = -72, chroma = 5, border = 0.07, mapBlur = 12 } = options;
  const id = `af-lg-${String(++nextId)}`;
  const { svg, image } = buildFilter(id, [scale, scale + chroma, scale + chroma * 2]);
  const previousProperty = target.style.getPropertyValue("--lg-refraction");
  const previousAttribute = target.getAttribute("data-refraction");
  document.body.append(svg);
  activeCount += 1;

  let lastWidth = 0;
  let lastHeight = 0;
  let timer: number | undefined;
  let destroyed = false;

  const setEnabled = (enabled: boolean): void => {
    if (enabled) {
      target.style.setProperty("--lg-refraction", `url(#${id})`);
      target.setAttribute("data-refraction", "on");
    } else {
      target.style.removeProperty("--lg-refraction");
      target.removeAttribute("data-refraction");
    }
  };

  const refresh = (): void => {
    if (destroyed) return;
    const width = target.offsetWidth;
    const height = target.offsetHeight;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    const map = width > 0 && height > 0 && width <= MAX_SURFACE_SIDE && height <= MAX_SURFACE_SIDE
      ? drawMap(width, height, cornerRadius(target, width, height), border, mapBlur)
      : null;
    if (!map) {
      setEnabled(false);
      return;
    }
    image.setAttribute("href", map);
    image.setAttribute("width", String(width));
    image.setAttribute("height", String(height));
    setEnabled(true);
  };

  refresh();
  const observer = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, RESIZE_DEBOUNCE_MS);
    })
    : null;
  observer?.observe(target);

  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      window.clearTimeout(timer);
      svg.remove();
      activeCount -= 1;
      if (previousProperty) target.style.setProperty("--lg-refraction", previousProperty);
      else target.style.removeProperty("--lg-refraction");
      if (previousAttribute === null) target.removeAttribute("data-refraction");
      else target.setAttribute("data-refraction", previousAttribute);
    },
  };
}

const BLOCKING_QUERIES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(forced-colors: active)",
] as const;

/** Refraction is allowed only in the resolved Quality tier and without accessibility overrides. */
export function refractionAllowed(root: HTMLElement = document.documentElement): boolean {
  if (root.dataset.performance !== "quality") return false;
  if (typeof matchMedia !== "function") return true;
  return !BLOCKING_QUERIES.some((query) => matchMedia(query).matches);
}

/**
 * Attaches edge refraction to `ref` while `active` is true and the resolved tier allows it.
 * A tier change (Settings preview included) or an accessibility media change tears the
 * effect down immediately and releases its nodes, observer and timer.
 */
export function useLiquidGlass(ref: RefObject<HTMLElement | null>, active: boolean, options: LiquidGlassOptions = {}): void {
  const { scale, chroma, border, mapBlur } = options;
  useEffect(() => {
    const target = ref.current;
    if (!active || !target) return;
    let handle: LiquidGlassHandle | null = null;
    const sync = (): void => {
      if (refractionAllowed()) handle ??= createLiquidGlass(target, { scale, chroma, border, mapBlur });
      else {
        handle?.destroy();
        handle = null;
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-performance"] });
    const queries = typeof matchMedia === "function" ? BLOCKING_QUERIES.map((query) => matchMedia(query)) : [];
    for (const query of queries) query.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      for (const query of queries) query.removeEventListener("change", sync);
      handle?.destroy();
    };
  }, [active, ref, scale, chroma, border, mapBlur]);
}
