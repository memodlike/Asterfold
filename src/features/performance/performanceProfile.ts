import type { PerformanceMode } from "../../domain/models";

export type ResolvedPerformanceMode = "quality" | "balanced" | "compatibility" | "software";

export interface PerformanceSignals {
  renderer: string | null;
  platform: string;
  deviceMemory: number | null;
  hardwareConcurrency: number;
  reducedTransparency: boolean;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software rasterizer|microsoft basic render/i;
const LEGACY_RENDERER = /radeon r5 230|caicos|radeon hd 6[0-9]{3}|radeon hd 7[0-5][0-9]{2}|intel\(r\) hd graphics 2[0-9]{3}|intel\(r\) hd graphics 3[0-9]{3}/i;

export function classifyPerformanceMode(
  preference: PerformanceMode,
  legacyLowPower: boolean,
  signals: PerformanceSignals,
): ResolvedPerformanceMode {
  if (preference === "quality") return "quality";
  if (preference === "balanced") return "balanced";
  // Software must win over the legacy low-power flag: the UI sets both when "No transparency" is chosen.
  if (preference === "software") return "software";
  if (preference === "compatibility" || legacyLowPower) return "compatibility";
  if (preference === "custom") {
    return signals.reducedTransparency ? "compatibility" : "quality";
  }
  if (signals.renderer && SOFTWARE_RENDERER.test(signals.renderer)) return "software";
  if (signals.renderer && LEGACY_RENDERER.test(signals.renderer)) return "compatibility";
  if (signals.reducedTransparency) return "compatibility";
  if (
    (signals.deviceMemory !== null && signals.deviceMemory <= 4) ||
    signals.hardwareConcurrency <= 4
  ) return "balanced";
  return "quality";
}

export type PerformanceRecommendationReason =
  | "software"
  | "legacyGpu"
  | "reducedTransparency"
  | "constrainedHardware"
  | "hardwareAccelerated";

export function recommendPerformanceProfile(signals: PerformanceSignals): {
  recommendedMode: ResolvedPerformanceMode;
  reason: PerformanceRecommendationReason;
} {
  if (signals.renderer && SOFTWARE_RENDERER.test(signals.renderer)) {
    return { recommendedMode: "software", reason: "software" };
  }
  if (signals.renderer && LEGACY_RENDERER.test(signals.renderer)) {
    return { recommendedMode: "compatibility", reason: "legacyGpu" };
  }
  if (signals.reducedTransparency) {
    return { recommendedMode: "compatibility", reason: "reducedTransparency" };
  }
  if (
    (signals.deviceMemory !== null && signals.deviceMemory <= 4) ||
    signals.hardwareConcurrency <= 4
  ) {
    return { recommendedMode: "balanced", reason: "constrainedHardware" };
  }
  return { recommendedMode: "quality", reason: "hardwareAccelerated" };
}

const RENDERER_CACHE_KEY = "asterfold:gpu-renderer:v1";
const RENDERER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

interface RendererCacheEntry { renderer: string | null; agent: string; checkedAt: number }

function probeRenderer(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!context) return null;
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = extension
      ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER));
    // Release the probe context immediately so weak GPUs do not keep an extra context alive.
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return renderer;
  } catch {
    return null;
  }
}

/**
 * Creating a WebGL context costs 5–60 ms and is slowest on exactly the machines that need
 * the fallback tiers, so the renderer string is cached per browser build for a week.
 */
export function rendererName(storage: Pick<Storage, "getItem" | "setItem"> | null = safeLocalStorage(), now = Date.now()): string | null {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  try {
    const cached = JSON.parse(storage?.getItem(RENDERER_CACHE_KEY) ?? "null") as Partial<RendererCacheEntry> | null;
    if (cached && cached.agent === agent && typeof cached.checkedAt === "number" && now - cached.checkedAt < RENDERER_CACHE_TTL
      && (cached.renderer === null || typeof cached.renderer === "string")) return cached.renderer;
  } catch {
    // A corrupt cache entry is replaced by a fresh probe below.
  }
  const renderer = probeRenderer();
  try {
    storage?.setItem(RENDERER_CACHE_KEY, JSON.stringify({ renderer, agent, checkedAt: now } satisfies RendererCacheEntry));
  } catch {
    // Storage denial only costs a repeated probe on the next tab.
  }
  return renderer;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function reducedTransparencyPreference(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-transparency: reduce)").matches;
  } catch {
    return false;
  }
}

let sessionSignals: PerformanceSignals | null = null;

/** Signals are stable for the lifetime of a tab; the new-tab page and Settings share one read. */
export function browserPerformanceSignals(): PerformanceSignals {
  sessionSignals ??= readBrowserPerformanceSignals();
  return sessionSignals;
}

export function resetPerformanceSignalsForTests(): void {
  sessionSignals = null;
}

function readBrowserPerformanceSignals(): PerformanceSignals {
  const extendedNavigator = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  return {
    renderer: rendererName(),
    platform: extendedNavigator.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent,
    deviceMemory: typeof extendedNavigator.deviceMemory === "number" ? extendedNavigator.deviceMemory : null,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    reducedTransparency: reducedTransparencyPreference(),
  };
}
