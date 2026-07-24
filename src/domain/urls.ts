import { ValidationError } from "./errors";

const MAX_URL_LENGTH = 8_192;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
]);

declare const safeNavigationUrlBrand: unique symbol;
export type SafeNavigationUrl = string & { readonly [safeNavigationUrlBrand]: true };

export interface SafeNavigationOptions {
  allowMailto?: boolean;
}

export interface NormalizedUrl {
  url: string;
  normalizedUrl: string;
  hostname: string;
}

function parseUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH || hasControlCharacters(input)) {
    throw new ValidationError("Enter a valid URL shorter than 8,192 characters");
  }
  try {
    return new URL(trimmed);
  } catch {
    throw new ValidationError("Enter a complete URL beginning with http:// or https://");
  }
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

export function parseSafeNavigationUrl(input: string, options: SafeNavigationOptions = {}): SafeNavigationUrl {
  const parsed = parseUrl(input);
  const mailtoAllowed = options.allowMailto === true && parsed.protocol === "mailto:";
  if (!WEB_PROTOCOLS.has(parsed.protocol) && !mailtoAllowed) {
    throw new ValidationError("This URL scheme is not allowed");
  }
  if (WEB_PROTOCOLS.has(parsed.protocol)) {
    if (parsed.username.length > 0 || parsed.password.length > 0) {
      throw new ValidationError("URLs containing credentials are not allowed");
    }
    if (!parsed.hostname) throw new ValidationError("This URL does not have a valid host");
  }
  const serialized = parsed.toString();
  if (serialized.length > MAX_URL_LENGTH || hasControlCharacters(serialized)) {
    throw new ValidationError("Enter a valid URL shorter than 8,192 characters");
  }
  return serialized as SafeNavigationUrl;
}

export function normalizeUrl(input: string, removeTracking = true): NormalizedUrl {
  const validatedUrl = parseSafeNavigationUrl(input, { allowMailto: true });
  const parsed = new URL(validatedUrl);
  if (parsed.protocol === "mailto:") {
    return {
      url: input.trim(),
      normalizedUrl: parsed.toString().toLowerCase(),
      hostname: "Email",
    };
  }

  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }
  if (removeTracking) {
    for (const key of [...parsed.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || TRACKING_PARAMETERS.has(lowerKey)) parsed.searchParams.delete(key);
    }
  }
  parsed.hash = "";

  return {
    url: input.trim(),
    normalizedUrl: parsed.toString(),
    hostname: parsed.hostname.replace(/^www\./u, ""),
  };
}

export function isSafeOpenUrl(input: string, options: SafeNavigationOptions = {}): boolean {
  try {
    parseSafeNavigationUrl(input, options);
    return true;
  } catch {
    return false;
  }
}
