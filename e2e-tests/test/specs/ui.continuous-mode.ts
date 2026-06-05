import { expect } from "@wdio/globals";
import { createFragmentViaUI } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Edit mode cleanup", () => {
  it("does not expose the removed continuous mode toggle", async () => {
    const workspaceName = `E2E RemovedContinuous ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    // The editor only mounts once a fragment is attached to the active recipe,
    // so seed the recipe with one fragment before waiting for it to appear.
    await createFragmentViaUI(`E2E ContinuousFixture ${Date.now()}`);

    await browser.waitUntil(async () => (await $("[data-testid='fragment-editor']")).isExisting(), {
      timeout: 20000,
      interval: 200,
    });

    await expect($("[data-testid='mode-fragment']")).not.toBeExisting();
    await expect($("[data-testid='mode-continuous']")).not.toBeExisting();
  });
});
