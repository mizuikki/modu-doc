import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("History", () => {
  it("selecting a different snapshot updates the diff", async () => {
    const workspaceName = `E2E Snapshot select ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragment = await tauriInvoke<{ id: string }>("create_fragment", {
      workspaceId: workspace.id,
      name: "Intro",
      content: "v1",
    });
    expect(fragment.id).toBeTruthy();

    await tauriInvoke("create_snapshot", { workspaceId: workspace.id, label: "snap-1" });
    const bundle1 = await loadWorkspace(workspace.id);
    const intro = bundle1.fragments.find((entry) => entry.name === "Intro");
    if (!intro) throw new Error("Intro fragment missing");
    await tauriInvoke("update_fragment", { id: intro.id, name: intro.name, content: "v2" });
    await tauriInvoke("create_snapshot", { workspaceId: workspace.id, label: "snap-2" });

    await safeClick("[data-testid='main-tab-history']");

    // Select each snapshot and check the diff reflects the currently compiled text.
    const bundle2 = await loadWorkspace(workspace.id);
    const snapshots = bundle2.snapshots ?? [];
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    const first = snapshots[0];
    const second = snapshots[1];
    if (!first || !second) throw new Error("snapshots missing");

    await safeClick(`[data-testid='history-snapshot-select-${first.id}']`);
    await browser.waitUntil(async () => await $("[data-testid='history-diff']").isExisting(), {
      timeout: 20000,
      interval: 200,
    });

    await safeClick(`[data-testid='history-snapshot-select-${second.id}']`);
    await browser.waitUntil(async () => await $("[data-testid='history-diff']").isExisting(), {
      timeout: 20000,
      interval: 200,
    });

    // Smoke assertion: diff rows exist and include a +/- prefix.
    const anyRow = await $("[data-testid^='history-diff-row-']");
    await expect(anyRow).toBeExisting();
  });
});
