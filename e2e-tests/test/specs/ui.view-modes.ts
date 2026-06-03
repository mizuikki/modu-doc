import { expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Edit workspace", () => {
  it("shows the single-surface editor and no legacy edit mode toggles", async () => {
    const workspaceName = `E2E EditSurface ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await browser.waitUntil(async () => (await $("[data-testid='fragment-editor']")).isExisting(), {
      timeout: 20000,
      interval: 200,
    });

    await expect($("[data-testid='view-mode-write']")).not.toBeExisting();
    await expect($("[data-testid='mode-fragment']")).not.toBeExisting();

    await safeClick("[data-testid='main-tab-preview']");
    await expect($("[data-testid='preview-open-target-folder']")).toBeDisplayed();

    await safeClick("[data-testid='main-tab-edit']");
    await expect($("[data-testid='fragment-editor']")).toBeDisplayed();
  });
});
