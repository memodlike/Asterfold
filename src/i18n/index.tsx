/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { LocalePreference } from "../domain/models";
import { ru, type MessageKey } from "./locales/ru";
import { en } from "./locales/en";
import { kk } from "./locales/kk";
import { es } from "./locales/es";
import { de } from "./locales/de";
import { fr } from "./locales/fr";
import { it } from "./locales/it";
import { pt } from "./locales/pt";
import { pl } from "./locales/pl";
import { uk } from "./locales/uk";
import { tr } from "./locales/tr";
import { nl } from "./locales/nl";

export type { MessageKey };
export const messageKeys = Object.keys(ru) as MessageKey[];

export type AppLocale = Exclude<LocalePreference, "auto">;

export const localeOptions: ReadonlyArray<{ value: LocalePreference; label: string; flag: string }> = [
  { value: "auto", label: "Auto (Chrome language)", flag: "🌐" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "kk", label: "Қазақша", flag: "🇰🇿" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "uk", label: "Українська", flag: "🇺🇦" },
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
  { value: "nl", label: "Nederlands", flag: "🇳🇱" },
];

const dictionaries: Record<AppLocale, Record<MessageKey, string>> = {
  ru,
  en,
  kk,
  es,
  de,
  fr,
  it,
  pt,
  pl,
  uk,
  tr,
  nl,
};

function detectLocale(): AppLocale {
  const chromeLocale = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : "";
  const language = (chromeLocale || (typeof navigator !== "undefined" ? navigator.language : "en")).toLowerCase().split("-")[0] ?? "en";
  return language in dictionaries ? language as AppLocale : "en";
}

export function resolveLocale(preference: LocalePreference): AppLocale {
  return preference === "auto" ? detectLocale() : preference;
}

function formatMessage(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

interface I18nValue {
  locale: AppLocale;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue>({ locale: "en", t: (key, values) => formatMessage(en[key], values) });

export function I18nProvider({ preference, children, documentTitle }: { preference: LocalePreference; children: ReactNode; documentTitle?: MessageKey }) {
  const locale = resolveLocale(preference);
  const value = useMemo<I18nValue>(() => ({
    locale,
    t: (key, values) => formatMessage(dictionaries[locale][key], values),
  }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (documentTitle) document.title = value.t(documentTitle);
  }, [documentTitle, locale, value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function translate(preference: LocalePreference, key: MessageKey, values?: Record<string, string | number>): string {
  const locale = resolveLocale(preference);
  return formatMessage(dictionaries[locale][key], values);
}
