import { browser, expect } from "@wdio/globals";
import { createAndOpenProject, deleteProject, getProjectCount } from "../support/project";
import { tauriInvoke } from "../support/tauri";

describe("Projects", () => {
  it("deletes a project and removes it from the sidebar and list_projects", async () => {
    // 1. Fresh project. The support helper asserts the sidebar row
    //    becomes active before returning.
    const projectName = `E2E Delete ${Date.now()}`;
    const { projectId } = await createAndOpenProject(projectName);

    // 2. Capture the project count before deleting so we can assert
    //    list_projects shrinks by exactly one.
    const before = await getProjectCount();
    expect(before).toBeGreaterThan(0);

    // 3. Drive delete_project directly. The backend removes the
    //    project (and all its documents / fragments / recipes /
    //    snapshots) in one transaction.
    await deleteProject(projectId);

    // 4. The project switcher must stop pointing at the deleted project.
    await browser.waitUntil(
      async () => {
        const switcher = await $("[data-testid='sidebar-project-switcher']");
        if (!(await switcher.isExisting())) return true;
        return (await switcher.getAttribute("data-current-project-id")) !== projectId;
      },
      { timeout: 20000, interval: 200, timeoutMsg: "deleted project still active in switcher" },
    );

    // 5. list_projects must shrink by one and no longer include the id.
    await browser.waitUntil(
      async () => {
        const list = await tauriInvoke<Array<{ id: string }>>("list_projects");
        return list.length === before - 1 && list.every((entry) => entry.id !== projectId);
      },
      { timeout: 20000, interval: 200, timeoutMsg: "list_projects did not shrink" },
    );

    // 6. Ensure the app is still responsive after the destructive op.
    //    Deleting the final project returns to the welcome screen; otherwise
    //    the shell stays mounted on the next active project.
    if (before - 1 === 0) {
      await expect($("[data-testid='welcome-create-project']")).toBeDisplayed();
      return;
    }
    await expect($("header")).toBeDisplayed();
    await expect($("[data-testid='header-language-toggle']")).toBeDisplayed();
  });
});
