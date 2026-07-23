import { describe, expect, it } from "vitest";
import { localeOptions, messageKeys, translate, type AppLocale } from "../src/i18n";

describe("runtime dictionaries", () => {
  it("contains a non-empty value for every supported language and message key", () => {
    expect(messageKeys.length).toBeGreaterThan(100);
    for (const locale of localeOptions.filter((item) => item.value !== "auto")) {
      for (const key of messageKeys) expect(translate(locale.value, key).trim(), `${locale.value}:${key}`).not.toBe("");
    }
  });

  it("provides localized new-tab titles for the core Chrome languages", () => {
    expect(translate("en", "tab.title")).toBe("New Tab");
    expect(translate("ru", "tab.title")).toBe("Новая вкладка");
    expect(translate("kk", "tab.title")).toBe("Жаңа қойынды");
    expect(translate("es", "tab.title")).toBe("Nueva pestaña");
  });

  it("keeps every selectable language on the localized new-tab path", () => {
    const expectedTitles = {
      de: "Neuer Tab", en: "New Tab", es: "Nueva pestaña", fr: "Nouvel onglet", it: "Nuova scheda",
      kk: "Жаңа қойынды", nl: "Nieuw tabblad", pl: "Nowa karta", pt: "Novo separador", ru: "Новая вкладка",
      tr: "Yeni sekme", uk: "Нова вкладка",
    } as const;
    for (const [locale, title] of Object.entries(expectedTitles)) {
      expect(translate(locale as AppLocale, "tab.title"), locale).toBe(title);
      expect(translate(locale as AppLocale, "popup.saveFailed"), locale).not.toBe("");
      expect(translate(locale as AppLocale, "error.updateSettings"), locale).not.toBe("");
    }
  });
});
