import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

describe("i18n locales", () => {
  it("keeps en/zh keys in sync", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });
});
