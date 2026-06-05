import { expect } from "@wdio/globals";
import { blurActiveElement, typeInFragmentEditor, waitForFragmentLabel } from "../support/editor";
import { createFragmentViaUI, safeClick } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("Fragments", () => {
  it("edits a fragment and persists via autosave", async () => {
    const workspaceName = `E2E Fragment autosave ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Autosave fragment ${Date.now()}`;
    await createFragmentViaUI(fragmentName);

    // createFragmentViaUI auto-attaches the new fragment to the recipe and
    // makes it the active fragment, so the editor underneath is already
    // pointing at the right document. Wait for the label to reflect that
    // before typing so we know the Milkdown editor is bound to it.
    await waitForFragmentLabel(fragmentName);

    const content = `Hello autosave ${Date.now()}`;
    await typeInFragmentEditor(content);
    // Blur the editor so Milkdown commits the markdown update and React
    // state catches up; otherwise the autosave effect never fires.
    await blurActiveElement();

    // Milkdown normalises the document to markdown on save, which appends a
    // trailing newline. Wait for the autosaved content to start with what
    // we typed rather than match it exactly.
    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return Boolean(fragment?.content?.trimStart().startsWith(content));
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("[data-testid='main-tab-preview']");
    await expect($(`p*=Hello autosave`)).toBeDisplayed();
  });
});
