import { expect } from "@wdio/globals";
import { setFragmentEditorContent } from "../support/editor";
import { createFragmentViaUI, safeClick } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("History", () => {
  it("creates a snapshot, shows a diff, and restores it", async () => {
    const workspaceName = `E2E Snapshot diff ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Snapshot fragment ${Date.now()}`;
    await createFragmentViaUI(fragmentName);

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        return bundle.fragments.some((entry) => entry.name === fragmentName);
      },
      { timeout: 20000, interval: 200 },
    );
    const bundleAfterCreate = await loadWorkspace(workspace.id);
    const created = bundleAfterCreate.fragments.find((entry) => entry.name === fragmentName);
    if (!created) throw new Error("fragment not created");
    await safeClick(`[data-testid='fragment-select-${created.id}']`);

    await setFragmentEditorContent("v1");
    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content === "v1";
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("[data-testid='main-tab-history']");
    await safeClick("[data-testid='history-create-snapshot']");

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        return (bundle.snapshots?.length ?? 0) >= 1;
      },
      { timeout: 20000, interval: 250 },
    );

    await safeClick("[data-testid='main-tab-edit']");
    await setFragmentEditorContent("v2");
    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content === "v2";
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("[data-testid='main-tab-history']");
    await browser.waitUntil(async () => await $("pre*=- v1").isDisplayed(), {
      timeout: 20000,
      interval: 250,
    });
    await expect($("pre*=- v1")).toBeDisplayed();
    await expect($("pre*=+ v2")).toBeDisplayed();

    const bundleForRestore = await loadWorkspace(workspace.id);
    const snapshot = bundleForRestore.snapshots?.[0];
    if (!snapshot) throw new Error("snapshot missing");
    await safeClick(`[data-testid='history-snapshot-restore-${snapshot.id}']`);

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
