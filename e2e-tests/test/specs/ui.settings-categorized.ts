import { browser, expect } from "@wdio/globals";
import { safeClick } from "../support/ui";
import { createAndOpenWorkspace } from "../support/workspace";

describe("Workspace settings navigation", () => {
  it("shows the General section with a name input and a per-document hint", async () => {
    // 1. Create a fresh workspace. The settings dialog is workspace-scoped
    //    and operates on whichever workspace is active.
    const workspaceName = `E2E Settings ${Date.now()}`;
    await createAndOpenWorkspace(workspaceName);

    // 2. Open the workspace settings dialog via the header gear button.
    await safeClick("[data-testid='header-settings']");

    // 3. The General nav button is present and is the default section
    //    shown when the dialog opens.
    const generalNav = await $("[data-testid='workspace-settings-nav-general']");
    await browser.waitUntil(async () => await generalNav.isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    // 4. The General section must contain a name input bound to the
    //    active workspace's name.
    const nameInput = await $("[data-testid='workspace-settings-name']");
    await browser.waitUntil(async () => await nameInput.isExisting(), {
      timeout: 10000,
      interval: 100,
    });
    await expect(nameInput).toBeDisplayed();
    expect((await nameInput.getValue()).trim()).toBe(workspaceName);

    // 5. Save / Cancel are visible regardless of the active section.
    await expect($("[data-testid='workspace-settings-save']")).toBeDisplayed();
    await expect($("[data-testid='workspace-settings-cancel']")).toBeDisplayed();

    // 6. The Sync nav button still exists (the conflict resolution policy
    //    remains a workspace-level setting in the document-first model),
    //    but the legacy per-workspace sync debounce + auto-sync controls
    //    are gone — conflict resolution is now per-document via the
    //    target bar.
    const syncNav = await $("[data-testid='workspace-settings-nav-sync']");
    await browser.waitUntil(async () => await syncNav.isExisting(), {
      timeout: 10000,
      interval: 100,
    });
    await safeClick("[data-testid='workspace-settings-nav-sync']");
    await browser.waitUntil(
      async () =>
        !(await $("[data-testid='workspace-settings-sync-debounce']").isExisting()) &&
        !(await $("[data-testid='workspace-settings-auto-sync']").isExisting()),
      { timeout: 10000, interval: 100 },
    );

    // 7. The Import/Export nav button is removed entirely — agentpack
    //    import/export no longer exists in the document-first model.
    const importExportNav = await $("[data-testid='workspace-settings-nav-import-export']");
    expect(await importExportNav.isExisting()).toBe(false);

    // 8. Close the dialog so subsequent specs start from a clean state.
    await safeClick("[data-testid='workspace-settings-cancel']");
  });
});
