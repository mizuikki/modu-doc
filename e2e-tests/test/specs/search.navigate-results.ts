import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick, safeSetValue } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Global search", () => {
  it("navigates to fragment, recipe, and snapshot results", async () => {
    const keyword = `nav-key-${Date.now()}`;
    const workspaceName = `E2E Search Nav ${keyword}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Fragment ${keyword}`;
    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: fragmentName,
      content: `content ${keyword}`,
    });

    const recipeName = `Recipe ${keyword}`;
    const recipe = await tauriInvoke<{ id: string }>("create_recipe", {
      workspaceId: workspace.id,
      name: recipeName,
      description: "",
    });

    await tauriInvoke("create_snapshot", { workspaceId: workspace.id, label: `Snap ${keyword}` });

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`button*=${fragmentName}`);
    await browser.waitUntil(
      async () => (await $("label[for='fragment-editor']").getText()).includes(fragmentName),
      {
        timeout: 20000,
        interval: 200,
      },
    );

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`button*=${recipeName}`);
    await expect($(`div*=${recipeName}`)).toBeDisplayed();

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`button*=Snap ${keyword}`);
    await expect($("button*=Create snapshot")).toBeDisplayed();
    await expect($(`div*=Snap ${keyword}`)).toBeDisplayed();

    expect(recipe.id).toBeTruthy();
  });
});
