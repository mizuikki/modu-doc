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

    // createFragmentViaUI auto-attaches the new fragment to the recipe and
    // makes it the active fragment, so the editor underneath is already
    // pointing at the right document. No library dialog round-trip needed.
    await setFragmentEditorContent("v1");
    // Milkdown normalises the document to markdown on save, which appends a
    // trailing newline. Compare with the typed text after trimming instead
    // of an exact match.
    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content?.trim() === "v1";
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
        return fragment?.content?.trim() === "v2";
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("[data-testid='main-tab-history']");
    await browser.waitUntil(async () => await $("td*=- v1").isExisting(), {
      timeout: 20000,
      interval: 250,
    });
    await expect($("td*=- v1")).toBeDisplayed();
    await expect($("td*=+ v2")).toBeDisplayed();

    const bundleForRestore = await loadWorkspace(workspace.id);
    const snapshot = bundleForRestore.snapshots?.[0];
    if (!snapshot) throw new Error("snapshot missing");
    await safeClick(`[data-testid='history-snapshot-restore-${snapshot.id}']`);

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content?.trim() === "v1";
      },
      { timeout: 30000, interval: 250 },
    );
  });
});
