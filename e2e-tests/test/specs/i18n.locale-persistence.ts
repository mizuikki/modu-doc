import { browser, expect } from "@wdio/globals";
import { dismissDocumentStatus, safeClick } from "../support/ui";

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
    // The status popover helper was renamed from `dismissWorkspaceStatus`
    // to `dismissDocumentStatus` (it's now the per-document status
    // popover, not the workspace one).
    await dismissDocumentStatus();

    // Start from English to avoid flakiness if another spec left it in ZH.
    const maybeEnButton = await $(languageToggleSelector);
    if (await maybeEnButton.isExisting()) {
      const currentLanguage = (await maybeEnButton.getText()).trim().toUpperCase();
      if (currentLanguage.startsWith("ZH")) {
        await safeClick(languageToggleSelector);
        await waitForLanguageButton("EN");
      } else {
        await waitForLanguageButton("EN");
      }
    } else {
      await waitForLanguageButton("EN");
    }

    // Switch to Chinese and assert the search input placeholder flips
    // to the new Chinese copy. The new placeholder covers all 5 search
    // kinds (workspace, fragment, recipe, snapshot + document).
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
    // WebView2 can render blank/unpainted regions after WebDriver window resizes on Windows.
    // The window starts at a stable size already; only resize on non-Windows platforms.
    if (process.platform !== "win32") {
      await browser.setWindowSize(1280, 900);
    }

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
