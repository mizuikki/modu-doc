import { browser, expect } from "@wdio/globals";
import { dismissWorkspaceStatus, safeClick } from "../support/ui";

const languageToggleSelector = "[data-testid='header-language-toggle']";

async function readLocalStorage(key: string) {
  return (await browser.execute((storageKey) => {
    return window.localStorage.getItem(String(storageKey));
  }, key)) as string | null;
}

async function waitForLanguageButton(label: "EN" | "ZH", timeoutMs = 20000) {
  await browser.waitUntil(
    async () => {
      const button = await $(languageToggleSelector);
      if (!(await button.isExisting())) {
        return false;
      }
      if (!(await button.isDisplayed())) {
        return false;
      }
      return (await button.getText()).trim().toUpperCase().startsWith(label);
    },
    {
      timeout: timeoutMs,
      interval: 200,
      timeoutMsg: `expected language toggle to show ${label}`,
    },
  );
  return await $(languageToggleSelector);
}

describe("i18n", () => {
  it("persists locale across app restart", async () => {
    await dismissWorkspaceStatus();

    // Start from English to avoid flakiness if another spec left it in ZH.
    const maybeZhButton = await $(languageToggleSelector);
    if (await maybeZhButton.isExisting()) {
      const currentLanguage = (await maybeZhButton.getText()).trim().toUpperCase();
      if (currentLanguage.startsWith("ZH")) {
        await safeClick(languageToggleSelector);
        await waitForLanguageButton("EN");
      } else {
        await waitForLanguageButton("EN");
      }
    } else {
      await waitForLanguageButton("EN");
    }

    // Switch to Chinese and assert UI changes + localStorage updated.
    await safeClick(languageToggleSelector);
    await waitForLanguageButton("ZH");
    await expect($("[data-testid='global-search-input']")).toHaveAttribute(
      "placeholder",
      "搜索工作区、片段、配方、快照",
    );
    await browser.waitUntil(async () => (await readLocalStorage("i18nextLng")) === "zh", {
      timeout: 20000,
      interval: 200,
      timeoutMsg: "expected i18nextLng to be persisted as zh",
    });

    // Restart the app session; language should still be ZH.
    await browser.reloadSession();
    await browser.setWindowSize(1280, 900);

    await browser.waitUntil(async () => (await readLocalStorage("i18nextLng")) === "zh", {
      timeout: 40000,
      interval: 200,
      timeoutMsg: "expected i18nextLng to still be persisted as zh after reloadSession",
    });
    await waitForLanguageButton("ZH", 40000);
    await expect($("[data-testid='global-search-input']")).toHaveAttribute(
      "placeholder",
      "搜索工作区、片段、配方、快照",
    );

    // Reset back to English for subsequent specs that rely on English text selectors.
    await safeClick(languageToggleSelector);
    await waitForLanguageButton("EN");
    await browser.waitUntil(async () => (await readLocalStorage("i18nextLng")) === "en", {
      timeout: 20000,
      interval: 200,
      timeoutMsg: "expected i18nextLng to be persisted as en",
    });
  });
});
