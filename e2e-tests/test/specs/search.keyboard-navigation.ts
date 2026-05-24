import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick, safeSetValue } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Global search", () => {
  it("supports arrow key navigation, enter to apply, and escape to clear", async () => {
    const keyword = `kbd-${Date.now()}`;
    const workspaceName = `E2E Search ${keyword}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Fragment ${keyword}`;
    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: fragmentName,
      content: `hello ${keyword}`,
    });

    const recipeName = `Recipe ${keyword}`;
    await tauriInvoke("create_recipe", {
      workspaceId: workspace.id,
      name: recipeName,
      description: "",
    });

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await browser.waitUntil(
      async () => await $("[data-testid='global-search-panel']").isExisting(),
      {
        timeout: 20000,
        interval: 200,
      },
    );

    // ArrowDown selects first item; Enter navigates.
    await browser.keys(["ArrowDown"]);
    await browser.keys(["Enter"]);

    await browser.waitUntil(
      async () => (await $("label[for='fragment-editor']").getText()).includes(fragmentName),
      { timeout: 20000, interval: 200 },
    );

    // Escape clears query and closes panel.
    await safeClick("[data-testid='global-search-input']");
    await safeSetValue("[data-testid='global-search-input']", keyword);
    await browser.waitUntil(
      async () => await $("[data-testid='global-search-panel']").isExisting(),
      {
        timeout: 20000,
        interval: 200,
      },
    );
    await browser.keys(["Escape"]);
    await browser.waitUntil(
      async () => !(await $("[data-testid='global-search-panel']").isExisting()),
      { timeout: 20000, interval: 200 },
    );

    await expect($("[data-testid='global-search-input']")).toHaveValue("");
  });
});
