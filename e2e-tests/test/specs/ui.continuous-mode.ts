import { expect } from "@wdio/globals";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Edit mode cleanup", () => {
  it("does not expose the removed continuous mode toggle", async () => {
    const workspaceName = `E2E RemovedContinuous ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await browser.waitUntil(async () => (await $("[data-testid='fragment-editor']")).isExisting(), {
      timeout: 20000,
      interval: 200,
    });

    await expect($("[data-testid='mode-fragment']")).not.toBeExisting();
    await expect($("[data-testid='mode-continuous']")).not.toBeExisting();
  });
});
