/** Maps a BCP 47 tag such as "pt-BR", "zh_TW" or legacy "in" to a supported locale code; falls back to English. */
export function matchLocale(tag: string, supported: readonly string[]): string {
  const language = tag.toLowerCase().split(/[-_]/u)[0] ?? "en";
  const normalized = language === "in" ? "id" : language === "mo" ? "ro" : language;
  return supported.includes(normalized) ? normalized : "en";
}
