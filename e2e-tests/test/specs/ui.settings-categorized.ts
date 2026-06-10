import { browser, expect } from "@wdio/globals";
import { createAndOpenProject, selectProjectById } from "../support/project";
import { safeClick } from "../support/ui";

describe("Project settings navigation", () => {
  it("shows the General section with a name input and a per-document hint", async () => {
    // 1. Create a fresh project. The settings dialog is project-scoped
    //    and operates on whichever project is active.
    const projectName = `E2E Settings ${Date.now()}`;
    const { projectId } = await createAndOpenProject(projectName);
    await selectProjectById(projectId);

    // 2. Open the project settings dialog via the header gear button.
    await safeClick("[data-testid='header-settings']");

    // 3. The General nav button is present and is the default section
    //    shown when the dialog opens.
    const generalNav = await $("[data-testid='project-settings-nav-general']");
    await browser.waitUntil(async () => await generalNav.isExisting(), {
      timeout: 10000,
      interval: 100,
    });

    // 4. The General section must contain a name input bound to the
    //    active project's name.
    const nameInput = await $("[data-testid='project-settings-name']");
    await browser.waitUntil(async () => await nameInput.isExisting(), {
      timeout: 10000,
      interval: 100,
    });
    await expect(nameInput).toBeDisplayed();
    expect((await nameInput.getValue()).trim()).toBe(projectName);

    // 5. Save / Cancel are visible regardless of the active section.
    await expect($("[data-testid='project-settings-save']")).toBeDisplayed();
    await expect($("[data-testid='project-settings-cancel']")).toBeDisplayed();

    // 6. The Sync nav button still exists (the conflict resolution policy
    //    remains a project-level setting in the document-first model),
    //    but the legacy per-project sync debounce + auto-sync controls
    //    are gone — conflict resolution is now per-document via the
    //    target bar.
    const syncNav = await $("[data-testid='project-settings-nav-sync']");
    await browser.waitUntil(async () => await syncNav.isExisting(), {
      timeout: 10000,
      interval: 100,
    });
    await safeClick("[data-testid='project-settings-nav-sync']");
    await browser.waitUntil(
      async () =>
        !(await $("[data-testid='project-settings-sync-debounce']").isExisting()) &&
        !(await $("[data-testid='project-settings-auto-sync']").isExisting()),
      { timeout: 10000, interval: 100 },
    );

    // 7. The Import/Export nav button is removed entirely — agentpack
    //    import/export no longer exists in the document-first model.
    const importExportNav = await $("[data-testid='project-settings-nav-import-export']");
    expect(await importExportNav.isExisting()).toBe(false);

    // 8. Close the dialog so subsequent specs start from a clean state.
    await safeClick("[data-testid='project-settings-cancel']");
  });
});
