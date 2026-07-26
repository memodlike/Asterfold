export interface PlatformShortcut {
  visual: string;
  aria: string;
}

export function detectedPlatform(): string {
  if (typeof navigator === "undefined") return "";
  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return userAgentData?.platform ?? navigator.platform ?? "";
}

export function isApplePlatform(platform = detectedPlatform()): boolean {
  return /mac|iphone|ipad|ipod/iu.test(platform);
}

export function primaryShortcut(key: string, platform = detectedPlatform()): PlatformShortcut {
  const trimmedKey = key.trim();
  const normalizedKey = trimmedKey.length === 1 ? trimmedKey.toUpperCase() : trimmedKey;
  return isApplePlatform(platform)
    ? { visual: `⌘ ${normalizedKey}`, aria: `Meta+${normalizedKey}` }
    : { visual: `Ctrl + ${normalizedKey}`, aria: `Control+${normalizedKey}` };
}
