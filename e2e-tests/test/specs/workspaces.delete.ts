import { browser, expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { createAndOpenWorkspace, deleteWorkspace, getWorkspaceCount } from "../support/workspace";

describe("Workspaces", () => {
  it("deletes a workspace and removes it from the sidebar and list_workspaces", async () => {
    // 1. Fresh workspace. The support helper asserts the sidebar row
    //    becomes active before returning.
    const workspaceName = `E2E Delete ${Date.now()}`;
    const { workspaceId } = await createAndOpenWorkspace(workspaceName);

    // 2. Capture the workspace count before deleting so we can assert
    //    list_workspaces shrinks by exactly one.
    const before = await getWorkspaceCount();
    expect(before).toBeGreaterThan(0);

    // 3. Drive delete_workspace directly. The backend removes the
    //    workspace (and all its documents / fragments / recipes /
    //    snapshots) in one transaction.
    await deleteWorkspace(workspaceId);

    // 4. The sidebar row for the deleted workspace must disappear.
    await browser.waitUntil(
      async () => !(await $(`[data-testid='sidebar-workspace-${workspaceId}']`).isExisting()),
      { timeout: 20000, interval: 200, timeoutMsg: "deleted workspace still in sidebar" },
    );

    // 5. list_workspaces must shrink by one and no longer include the id.
    await browser.waitUntil(
      async () => {
        const list = await tauriInvoke<Array<{ id: string }>>("list_workspaces");
        return list.length === before - 1 && list.every((entry) => entry.id !== workspaceId);
      },
      { timeout: 20000, interval: 200, timeoutMsg: "list_workspaces did not shrink" },
    );

    // 6. Ensure the app is still responsive after the destructive op:
    //    the header is still rendered and the language toggle is
    //    clickable.
    await expect($("header")).toBeDisplayed();
    await expect($("[data-testid='header-language-toggle']")).toBeDisplayed();
  });
});
