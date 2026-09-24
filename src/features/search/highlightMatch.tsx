import type { ReactNode } from "react";

/** Marks the first case-insensitive occurrence of the query (or its longest word) without HTML injection. */
export function highlightMatch(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const lower = text.toLocaleLowerCase();
  // Some case mappings change length (Turkish "İ" → "i̇"); offsets would drift, so skip marking.
  if (lower.length !== text.length) return text;
  const candidates = [needle, ...needle.split(/\s+/u).sort((a, b) => b.length - a.length)].filter((item) => item.length > 0);
  for (const candidate of candidates) {
    const index = lower.indexOf(candidate.toLocaleLowerCase());
    if (index < 0) continue;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + candidate.length)}</mark>{text.slice(index + candidate.length)}</>;
  }
  return text;
}
