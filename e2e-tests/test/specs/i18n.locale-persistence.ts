import { browser, expect } from "@wdio/globals";
import { dismissWorkspaceStatus, safeClick } from "../support/ui";

async function readLocalStorage(key: string) {
  return (await browser.execute((storageKey) => {
    return window.localStorage.getItem(String(storageKey));
  }, key)) as string | null;
}

async function waitForLanguageButton(label: "EN" | "ZH", timeoutMs = 20000) {
  const button = await $(`button*=${label}`);
  await button.waitForExist({ timeout: timeoutMs });
  await button.waitForDisplayed({ timeout: timeoutMs });
  return button;
}

describe("i18n", () => {
  it("persists locale across app restart", async () => {
    await dismissWorkspaceStatus();

    // Start from English to avoid flakiness if another spec left it in ZH.
    const maybeZhButton = await $("button*=ZH");
    if (await maybeZhButton.isExisting()) {
      await safeClick("button*=ZH");
      await waitForLanguageButton("EN");
    } else {
      await waitForLanguageButton("EN");
    }

    // Switch to Chinese and assert UI changes + localStorage updated.
    await safeClick("button*=EN");
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

    await waitForLanguageButton("ZH", 40000);
    await expect($("[data-testid='global-search-input']")).toHaveAttribute(
      "placeholder",
      "搜索工作区、片段、配方、快照",
    );

    // Reset back to English for subsequent specs that rely on English text selectors.
    await safeClick("button*=ZH");
    await waitForLanguageButton("EN");
    await browser.waitUntil(async () => (await readLocalStorage("i18nextLng")) === "en", {
      timeout: 20000,
      interval: 200,
      timeoutMsg: "expected i18nextLng to be persisted as en",
    });
  });
});
