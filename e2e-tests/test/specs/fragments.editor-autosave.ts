import { expect } from "@wdio/globals";
import { setFragmentEditorContent } from "../support/editor";
import { createFragmentViaUI, safeClick } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("Fragments", () => {
  it("edits a fragment and persists via autosave", async () => {
    const workspaceName = `E2E Fragment autosave ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Autosave fragment ${Date.now()}`;
    await createFragmentViaUI(fragmentName);

    const bundleForSelect = await loadWorkspace(workspace.id);
    const created = bundleForSelect.fragments.find((entry) => entry.name === fragmentName);
    if (!created) throw new Error("fragment not created");
    await safeClick(`[data-testid='fragment-select-${created.id}']`);
    await browser.waitUntil(
      async () => (await $("label[for='fragment-editor']").getText()).includes(fragmentName),
      {
        timeout: 20000,
        interval: 200,
      },
    );

    const content = `# Title\n\nHello autosave ${Date.now()}`;
    await setFragmentEditorContent(content);

    await browser.waitUntil(
      async () => {
        const bundle = await loadWorkspace(workspace.id);
        const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
        return fragment?.content === content;
      },
      { timeout: 30000, interval: 250 },
    );

    await safeClick("[data-testid='main-tab-preview']");
    await expect($("h1=Title")).toBeDisplayed();
    await expect($(`p*=Hello autosave`)).toBeDisplayed();
  });
});
