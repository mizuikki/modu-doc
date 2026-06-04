import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Workspace settings navigation", () => {
  it("lists three categorized nav buttons and renders sync content", async () => {
    const workspaceName = `E2E Settings ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await safeClick("[data-testid='header-settings']");

    const generalNav = await $("[data-testid='workspace-settings-nav-general']");
    const syncNav = await $("[data-testid='workspace-settings-nav-sync']");
    const importExportNav = await $("[data-testid='workspace-settings-nav-import-export']");

    await browser.waitUntil(
      async () =>
        (await generalNav.isExisting()) &&
        (await syncNav.isExisting()) &&
        (await importExportNav.isExisting()),
      { timeout: 10000, interval: 100 },
    );

    await safeClick("[data-testid='workspace-settings-nav-sync']");
    await browser.waitUntil(
      async () => {
        const node = await $("[data-testid='workspace-settings-sync-debounce']");
        return await node.isExisting();
      },
      { timeout: 10000, interval: 100 },
    );

    await expect($("[data-testid='workspace-settings-auto-sync']")).toBeDisplayed();
    await expect($("[data-testid='workspace-settings-save']")).toBeDisplayed();
    await expect($("[data-testid='workspace-settings-cancel']")).toBeDisplayed();

    await safeClick("[data-testid='workspace-settings-cancel']");
  });
});
