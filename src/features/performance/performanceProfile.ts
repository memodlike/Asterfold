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
  if (preference === "compatibility" || legacyLowPower) return "compatibility";
  if (preference === "software") return "software";
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

function rendererName(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!context) return null;
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    return extension
      ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER));
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

export function browserPerformanceSignals(): PerformanceSignals {
  const extendedNavigator = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  return {
    renderer: rendererName(),
    platform: extendedNavigator.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent,
    deviceMemory: typeof extendedNavigator.deviceMemory === "number" ? extendedNavigator.deviceMemory : null,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    reducedTransparency: reducedTransparencyPreference(),
  };
}
