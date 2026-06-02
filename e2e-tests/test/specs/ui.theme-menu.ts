import { browser } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

async function isDocumentDark(): Promise<boolean> {
  return (await browser.execute(() =>
    document.documentElement.classList.contains("dark"),
  )) as boolean;
}

async function waitForThemeItem(value: "light" | "dark" | "system", timeoutMs = 10000) {
  const item = await $(`[data-testid='theme-menu-${value}']`);
  await browser.waitUntil(async () => await item.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
  return item;
}

describe("Theme menu", () => {
  it("switches to dark mode via the header theme menu", async () => {
    const workspaceName = `E2E Theme ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const themeButton = await $("[data-testid='header-theme-menu']");
    await browser.waitUntil(async () => await themeButton.isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    await safeClick("[data-testid='header-theme-menu']");
    await waitForThemeItem("light");
    await safeClick("[data-testid='theme-menu-light']");
    await browser.waitUntil(async () => !(await isDocumentDark()), {
      timeout: 10000,
      interval: 100,
    });

    await safeClick("[data-testid='header-theme-menu']");
    await waitForThemeItem("dark");
    await safeClick("[data-testid='theme-menu-dark']");
    await browser.waitUntil(async () => await isDocumentDark(), {
      timeout: 10000,
      interval: 100,
    });
  });
});
