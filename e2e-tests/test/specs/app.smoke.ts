import { browser, expect } from "@wdio/globals";
import { createAndOpenProject, loadProject } from "../support/project";

describe("ModuDoc app", () => {
  it("smokes the empty root window", async () => {
    const welcome = await $("[data-testid='welcome-screen']");
    await welcome.waitForExist({ timeout: 20000 });
    await expect(welcome).toBeDisplayed();
    await expect($("[data-testid='welcome-title']")).toHaveText("ModuDoc");
    await expect($("[data-testid='welcome-create-project']")).toBeDisplayed();
  });

  it("starts with the project creation call to action before any project exists", async () => {
    await expect($("[data-testid='welcome-subtitle']")).toHaveText(
      "Document-first markdown editor.",
    );
  });

  it("auto-activates Untitled.md and binds the document editor after creating a project", async () => {
    const projectName = `E2E Smoke auto-main ${Date.now()}`;
    const { projectId, documentId } = await createAndOpenProject(projectName);

    // 1. Sidebar must mark Untitled.md as the active document.
    const sidebarRow = await $(`[data-testid='sidebar-document-${documentId}']`);
    await sidebarRow.waitForExist({ timeout: 20000 });
    await expect(sidebarRow).toHaveAttribute("data-active", "true");

    // 2. Document header is rendered and shows Untitled.md as the active title.
    const header = await $("[data-testid='document-header']");
    await header.waitForExist({ timeout: 20000 });
    const title = await $("[data-testid='document-header-title']");
    await title.waitForExist({ timeout: 20000 });
    const titleText = await browser.waitUntil(
      async () => {
        const value = await browser.execute(() => {
          return (
            document.querySelector("[data-testid='document-header-title']")?.textContent ?? ""
          ).trim();
        });
        return value || null;
      },
      { timeout: 20000, interval: 200, timeoutMsg: "document title text not rendered" },
    );
    expect(titleText).toBe("Untitled.md");

    // 3. The center editor textarea must exist and be bound to the active
    //    document (i.e. the active document in the store matches the one
    //    loaded from the backend).
    const textarea = await $("[data-testid='editor-pane-textarea']");
    await textarea.waitForExist({ timeout: 20000 });
    await expect(textarea).toBeDisplayed();

    // 4. load_project confirms the project now contains Untitled.md.
    const bundle = await loadProject(projectId);
    const doc = bundle.documents.find((entry) => entry.id === documentId);
    expect(doc).toBeTruthy();
    expect(doc?.name).toBe("Untitled.md");
  });
});
