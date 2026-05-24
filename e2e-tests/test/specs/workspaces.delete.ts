import { browser, expect } from "@wdio/globals";
import { safeSetValue } from "../support/ui";
import { createAndSelectWorkspace, deleteWorkspace } from "../support/workspace";

describe("Workspaces", () => {
  it("deletes a workspace and removes it from UI", async () => {
    const workspaceName = `E2E Delete ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await deleteWorkspace(workspace.id);

    await browser.waitUntil(
      async () => !(await $(`option[value="${workspace.id}"]`).isExisting()),
      { timeout: 20000, interval: 200 },
    );

    // Search should not find it either.
    await safeSetValue("[data-testid='global-search-input']", workspaceName);
    await browser.waitUntil(
      async () => await $("[data-testid='global-search-panel']").isExisting(),
      {
        timeout: 20000,
        interval: 200,
      },
    );
    await browser.waitUntil(
      async () => (await $(`button*=${workspaceName}`).isExisting()) === false,
      { timeout: 8000, interval: 200 },
    );

    // Ensure app still renders by checking header still present.
    await expect($("header")).toBeDisplayed();
  });
});
