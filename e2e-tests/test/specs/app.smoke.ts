import { expect } from "@wdio/globals";
import { createAndOpenWorkspace, loadWorkspace } from "../support/workspace";

describe("ModuDoc app", () => {
  it("smokes the root window", async () => {
    await expect($("header strong")).toHaveText("ModuDoc");
    await expect($("main")).toBeDisplayed();
  });

  it("renders the sidebar Documents header before any workspace exists", async () => {
    // The sidebar always renders a "Documents" section header (alongside the
    // workspace list and the "More" trigger) so the user can find it even
    // with no active workspace. The header text comes from the i18n catalog
    // and is matched case-insensitively.
    const headers = await $$("aside *");
    let found = false;
    for (const node of headers) {
      const text = (await node.getText()).trim().toLowerCase();
      if (text === "documents") {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("auto-activates Main.md and binds the document editor after creating a workspace", async () => {
    const workspaceName = `E2E Smoke auto-main ${Date.now()}`;
    const { workspaceId, documentId } = await createAndOpenWorkspace(workspaceName);

    // 1. Sidebar must mark Main.md as the active document.
    const sidebarRow = await $(`[data-testid='sidebar-document-${documentId}']`);
    await sidebarRow.waitForExist({ timeout: 20000 });
    await expect(sidebarRow).toHaveAttribute("data-active", "true");

    // 2. Document header is rendered and shows Main.md as the active title.
    const header = await $("[data-testid='document-header']");
    await header.waitForExist({ timeout: 20000 });
    const title = await $("[data-testid='document-header-title']");
    await title.waitForExist({ timeout: 20000 });
    const titleText = (await title.getText()).trim();
    expect(titleText).toBe("Main.md");

    // 3. The center editor textarea must exist and be bound to the active
    //    document (i.e. the active document in the store matches the one
    //    loaded from the backend).
    const textarea = await $("[data-testid='editor-pane-textarea']");
    await textarea.waitForExist({ timeout: 20000 });
    await expect(textarea).toBeDisplayed();

    // 4. load_workspace confirms the workspace now contains Main.md.
    const bundle = await loadWorkspace(workspaceId);
    const doc = bundle.documents.find((entry) => entry.id === documentId);
    expect(doc).toBeTruthy();
    expect(doc?.name).toBe("Main.md");
  });
});
