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
    const fragment = await tauriInvoke<{ id: string }>("create_fragment", {
      workspaceId: workspace.id,
      name: fragmentName,
      content: `content ${keyword}`,
    });
    expect(fragment.id).toBeTruthy();

    const recipeName = `Recipe ${keyword}`;
    const recipe = await tauriInvoke<{ id: string }>("create_recipe", {
      workspaceId: workspace.id,
      name: recipeName,
      description: "",
    });
    expect(recipe.id).toBeTruthy();

    const snapshot = await tauriInvoke<{ id: string }>("create_snapshot", {
      workspaceId: workspace.id,
      label: `Snap ${keyword}`,
    });
    expect(snapshot.id).toBeTruthy();

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`[data-testid='global-search-result-fragment-${fragment.id}']`);
    await browser.waitUntil(
      async () => (await $("label[for='fragment-editor']").getText()).includes(fragmentName),
      {
        timeout: 20000,
        interval: 200,
      },
    );

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`[data-testid='global-search-result-recipe-${recipe.id}']`);
    await expect($(`[data-testid='main-tab-edit']`)).toBeDisplayed();
    await expect($(`[data-testid='recipe-select'][title*='${recipeName}']`)).toBeDisplayed();

    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`[data-testid='global-search-result-snapshot-${snapshot.id}']`);
    await expect($("[data-testid='history-create-snapshot']")).toBeDisplayed();
    await expect($(`[data-testid='history-snapshot-${snapshot.id}']`)).toBeDisplayed();
  });
});
