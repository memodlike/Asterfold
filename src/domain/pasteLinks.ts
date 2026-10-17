import { recoverBookmarkTitle } from "./bookmarkNaming";
import { normalizeUrl, parseSafeNavigationUrl } from "./urls";

export const MAX_PASTE_TEXT_LENGTH = 100_000;
export const MAX_PASTE_URLS = 200;

export interface PastedLinks {
  urls: string[];
  items: { url: string; title: string }[];
  duplicate: number;
  invalid: number;
}

function trimProsePunctuation(candidate: string): string {
  const excess = new Map<string, number>(([["(", ")"], ["[", "]"], ["{", "}"]] as const)
    .map(([opening, closing]) => [closing, candidate.split(closing).length - candidate.split(opening).length]));
  let end = candidate.length;
  while (end > 0) {
    const character = candidate[end - 1]!;
    if (/[.,;:!?]/u.test(character)) end -= 1;
    else if ((excess.get(character) ?? 0) > 0) {
      excess.set(character, excess.get(character)! - 1);
      end -= 1;
    } else break;
  }
  return candidate.slice(0, end);
}

function parseStandaloneUrl(candidate: string): string {
  try {
    return parseSafeNavigationUrl(candidate);
  } catch {
    return parseSafeNavigationUrl(trimProsePunctuation(candidate));
  }
}

export function analyzePastedLinks(text: string, existingUrls: readonly string[] = []): PastedLinks {
  const result: PastedLinks = { urls: [], items: [], duplicate: 0, invalid: 0 };
  if (text.length > MAX_PASTE_TEXT_LENGTH) return result;
  const seen = new Set(existingUrls);
  for (const line of text.split(/\r\n?|\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    let validLine = false;
    const lineUrls = new Set<string>();
    // Require a text boundary, so an HTTP substring inside an unsafe scheme is not extracted.
    // A Markdown label such as [https://a](https://b) must not swallow its target.
    const scanLine = line.replaceAll("](", "] (");
    for (const match of scanLine.matchAll(/(?<=^|[\s<>([{'"`])https?:\/\/[^\s<>"'`]+/giu)) {
      try {
        const raw = match[0];
        // A line that is exactly one URL is kept intact when valid: trailing "!" or ")" may be part of it.
        const url = raw === trimmedLine ? parseStandaloneUrl(raw) : parseSafeNavigationUrl(trimProsePunctuation(raw));
        const normalized = normalizeUrl(url).normalizedUrl;
        validLine = true;
        if (lineUrls.has(normalized)) continue;
        lineUrls.add(normalized);
        result.urls.push(url);
        if (seen.has(normalized)) result.duplicate += 1;
        else {
          seen.add(normalized);
          result.items.push({ url, title: recoverBookmarkTitle(null, url) });
        }
        if (result.urls.length === MAX_PASTE_URLS) return result;
      } catch {
        // A line counts as invalid only when none of its candidates is safe.
      }
    }
    if (!validLine) result.invalid += 1;
  }
  return result;
}
