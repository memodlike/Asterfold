import { ValidationError } from "./errors";

const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "chrome:",
  "chrome-extension:",
  "about:",
]);

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

export interface NormalizedUrl {
  url: string;
  normalizedUrl: string;
  hostname: string;
}

export function normalizeUrl(input: string, removeTracking = true): NormalizedUrl {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 8_192) {
    throw new ValidationError("Enter a valid URL shorter than 8,192 characters");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError("Enter a complete URL beginning with http:// or https://");
  }

  if (BLOCKED_PROTOCOLS.has(parsed.protocol) || !["http:", "https:", "mailto:"].includes(parsed.protocol)) {
    throw new ValidationError("This URL scheme is not allowed");
  }

  if (parsed.protocol === "mailto:") {
    return {
      url: parsed.toString(),
      normalizedUrl: parsed.toString().toLowerCase(),
      hostname: "Email",
    };
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }
  if (removeTracking) {
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
  }
  parsed.hash = "";
  if (parsed.pathname === "") parsed.pathname = "/";

  return {
    url: trimmed,
    normalizedUrl: parsed.toString(),
    hostname: parsed.hostname.replace(/^www\./, ""),
  };
}

export function isSafeOpenUrl(input: string): boolean {
  try {
    normalizeUrl(input, false);
    return true;
  } catch {
    return false;
  }
}
