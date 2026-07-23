import { describe, expect, it } from "vitest";
import { localeOptions, messageKeys, translate } from "../src/i18n";

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
});
