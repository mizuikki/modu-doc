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

    const bundle = await loadWorkspace(workspace.id);
    const betaFragment = bundle.fragments.find((fragment) => fragment.name === beta);
    if (!betaFragment) throw new Error("missing Beta fragment");

    await safeClick(`[data-testid='recipe-item-toggle-${betaFragment.id}']`);

    await safeClick("[data-testid='main-tab-preview']");
    await expect($("p*=A")).toBeDisplayed();
    await expect($("p*=C")).toBeDisplayed();
    await expect($("p*=B")).not.toBeExisting();

    await safeClick("[data-testid='main-tab-edit']");

    await safeClick("[data-testid='recipe-save-as-new']");
    const clonedName = `Cloned ${Date.now()}`;
    await safeSetValue("[data-testid='app-prompt-input']", clonedName);
    await safeClick("[data-testid='app-dialog-confirm']");

    await browser.waitUntil(
      async () => {
        await safeClick("[data-testid='recipe-select']", 30000);
        const items = await $$("[data-testid^='recipe-select-item-']");
        for (const item of items as unknown as WebdriverIO.Element[]) {
          const text = await item.getText();
          if (text === clonedName) return true;
        }
        await safeClick("[data-testid='recipe-select']", 30000);
        return false;
      },
      { timeout: 30000, interval: 250 },
    );
  });
});
