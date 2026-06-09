import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndOpenWorkspace } from "../support/workspace";

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
  it("switches between light and dark via the header theme menu", async () => {
    // 1. Open a fresh workspace so the header is fully rendered.
    const workspaceName = `E2E Theme ${Date.now()}`;
    await createAndOpenWorkspace(workspaceName);

    // 2. Open the theme menu and pick light. Document root should drop
    //    the .dark class.
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
    expect(await isDocumentDark()).toBe(false);

    // 3. Re-open the menu and pick dark. The .dark class should come back.
    await safeClick("[data-testid='header-theme-menu']");
    await waitForThemeItem("dark");
    await safeClick("[data-testid='theme-menu-dark']");
    await browser.waitUntil(async () => await isDocumentDark(), {
      timeout: 10000,
      interval: 100,
    });
    expect(await isDocumentDark()).toBe(true);
  });
});
