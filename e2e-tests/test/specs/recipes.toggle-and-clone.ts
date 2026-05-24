import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick, safeSetValue } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("Recipes", () => {
  it("toggles recipe items and clones a recipe", async () => {
    const workspaceName = `E2E Recipe toggle ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const alpha = "Alpha";
    const beta = "Beta";
    const gamma = "Gamma";
    await tauriInvoke("create_fragment", { workspaceId: workspace.id, name: alpha, content: "A" });
    await tauriInvoke("create_fragment", { workspaceId: workspace.id, name: beta, content: "B" });
    await tauriInvoke("create_fragment", { workspaceId: workspace.id, name: gamma, content: "C" });

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        return (
          bundle.fragments.some((f) => f.name === alpha) &&
          bundle.fragments.some((f) => f.name === gamma)
        );
      },
      { timeout: 20000, interval: 250 },
    );

    await expect($(`strong=${alpha}`)).toBeDisplayed();
    await expect($(`strong=${beta}`)).toBeDisplayed();

    const betaToggle = await $(
      `//strong[normalize-space()="${beta}"]/ancestor::div[contains(@style,"border-radius")][1]//button[contains(.,"Disable")]`,
    );
    await betaToggle.waitForExist({ timeout: 20000 });
    await betaToggle.click();

    await safeClick("button*=Preview");
    await expect($("p*=A")).toBeDisplayed();
    await expect($("p*=C")).toBeDisplayed();
    await expect($("p*=B")).not.toBeExisting();

    await safeClick("button*=Edit");

    await safeClick("button*=Save as new recipe");
    const clonedName = `Cloned ${Date.now()}`;
    await safeSetValue("[data-testid='app-prompt-input']", clonedName);
    await safeClick("[data-testid='app-dialog-confirm']");

    await browser.waitUntil(
      async () => {
        const recipeSelect = await $("[data-testid='recipe-select']");
        const options = await recipeSelect.$$("option");
        for (const option of options as unknown as WebdriverIO.Element[]) {
          if ((await option.getText()) === clonedName) return true;
        }
        return false;
      },
      { timeout: 30000, interval: 250 },
    );
  });
});
