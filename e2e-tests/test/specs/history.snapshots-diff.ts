import { expect } from "@wdio/globals";
import { setFragmentEditorContent } from "../support/editor";
import { safeClick, safeSetValue } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("History", () => {
  it("creates a snapshot, shows a diff, and restores it", async () => {
    const workspaceName = `E2E Snapshot diff ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Snapshot fragment ${Date.now()}`;
    await safeClick("button*=New fragment");
    await safeSetValue("[data-testid='app-prompt-input']", fragmentName);
    await safeClick("[data-testid='app-dialog-confirm']");
    await safeClick(`button*=${fragmentName}`);

    await setFragmentEditorContent("v1");
    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content === "v1";
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("button*=History");
    await safeClick("button*=Create snapshot");

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        return (bundle.snapshots?.length ?? 0) >= 1;
      },
      { timeout: 20000, interval: 250 },
    );

    await safeClick("button*=Edit");
    await setFragmentEditorContent("v2");
    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content === "v2";
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("button*=History");
    await browser.waitUntil(async () => await $("pre*=- v1").isDisplayed(), {
      timeout: 20000,
      interval: 250,
    });
    await expect($("pre*=- v1")).toBeDisplayed();
    await expect($("pre*=+ v2")).toBeDisplayed();

    await safeClick("button*=Restore");

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content === "v1";
      },
      { timeout: 30000, interval: 250 },
    );
  });
});
