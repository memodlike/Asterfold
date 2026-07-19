import { describe, expect, it } from "vitest";
import { messageKeys, translate } from "../src/i18n";

describe("runtime dictionaries", () => {
  it("contains a non-empty RU and KK value for every message key", () => {
    expect(messageKeys.length).toBeGreaterThan(100);
    for (const key of messageKeys) {
      expect(translate("ru", key).trim(), `ru:${key}`).not.toBe("");
      expect(translate("kk", key).trim(), `kk:${key}`).not.toBe("");
    }
  });
});
