import { describe, expect, it } from "vitest";
import { i18n } from "@/i18n/i18n";

describe("i18n ICU plural keys", () => {
  it("renders library_insert_hint singular and plural correctly", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("library_insert_hint", { count: 1 })).toBe("1 fragment is available to insert.");
    expect(i18n.t("library_insert_hint", { count: 0 })).toBe(
      "0 fragments are available to insert.",
    );
    expect(i18n.t("library_insert_hint", { count: 5 })).toBe(
      "5 fragments are available to insert.",
    );

    await i18n.changeLanguage("zh");
    expect(i18n.t("library_insert_hint", { count: 1 })).toBe("还有 1 个片段可插入当前配方。");
    expect(i18n.t("library_insert_hint", { count: 7 })).toBe("还有 7 个片段可插入当前配方。");
  });

  it("renders changes_count singular and plural correctly", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("changes_count", { count: 1 })).toBe("1 change");
    expect(i18n.t("changes_count", { count: 2 })).toBe("2 changes");
    expect(i18n.t("changes_count", { count: 17 })).toBe("17 changes");

    await i18n.changeLanguage("zh");
    expect(i18n.t("changes_count", { count: 1 })).toBe("1 处变更");
    expect(i18n.t("changes_count", { count: 17 })).toBe("17 处变更");
  });
});
