import { useEffect, useState } from "react";

export type PerformanceTier = "standard" | "reduced";

interface DeviceCapabilities {
  hardwareConcurrency?: number | undefined;
  deviceMemory?: number | undefined;
  prefersReducedMotion?: boolean | undefined;
}

export function initialPerformanceTier(capabilities: DeviceCapabilities): PerformanceTier {
  if (capabilities.prefersReducedMotion) return "reduced";
  if (typeof capabilities.deviceMemory === "number" && capabilities.deviceMemory <= 4) return "reduced";
  if (typeof capabilities.hardwareConcurrency === "number" && capabilities.hardwareConcurrency <= 4) return "reduced";
  return "standard";
}

export function shouldReduceForFrameSamples(samples: number[]): boolean {
  return samples.filter((duration) => duration > 40).length >= 3;
}

function capabilities(): DeviceCapabilities {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigatorWithMemory.deviceMemory,
    prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function usePerformanceTier(): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>(() => initialPerformanceTier(capabilities()));

  useEffect(() => {
    if (tier === "reduced") return;
    const frameSamples: number[] = [];
    let previous = performance.now();
    let frameId = 0;
    const measure = (now: number): void => {
      frameSamples.push(now - previous);
      previous = now;
      if (frameSamples.length >= 36) {
        if (shouldReduceForFrameSamples(frameSamples)) setTier("reduced");
        return;
      }
      frameId = requestAnimationFrame(measure);
    };
    frameId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frameId);
  }, [tier]);

  return tier;
}
