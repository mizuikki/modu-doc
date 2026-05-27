import { browser, expect } from "@wdio/globals";
import { safeSetValue } from "../support/ui";
import { createAndSelectWorkspace, deleteWorkspace } from "../support/workspace";
import { tauriInvoke } from "../support/tauri";

describe("Workspaces", () => {
  it("deletes a workspace and removes it from UI", async () => {
    const workspaceName = `E2E Delete ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    await deleteWorkspace(workspace.id);

    await browser.waitUntil(
      async () => {
        const workspaces = await tauriInvoke<Array<{ id: string }>>("list_workspaces");
        return workspaces.every((entry) => entry.id !== workspace.id);
      },
      { timeout: 20000, interval: 200 },
    );

    // Search should not find it either.
    await safeSetValue("[data-testid='global-search-input']", workspaceName);
    await browser.waitUntil(
      async () => (await $$("[data-testid='global-search-panel']")).length > 0,
      {
        timeout: 20000,
        interval: 200,
      },
    );
    await browser.waitUntil(
      async () => {
        const panels = await $$("[data-testid='global-search-panel']");
        if (panels.length === 0) return false;

        const panelText = await panels[0].getText();
        if (panelText.includes("…")) return false;

        return (await $$("[data-testid^='global-search-result-workspace-']")).length === 0;
      },
      { timeout: 8000, interval: 200 },
    );

    // Ensure app still renders by checking header still present.
    await expect($("header")).toBeDisplayed();
  });
});
