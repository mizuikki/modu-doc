import { createFragmentViaUI, openLibraryDialog, safeClick } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("Fragments", () => {
  it("deletes and restores a fragment via the list UI", async () => {
    const workspaceName = `E2E Fragment delete ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath: null });

    const fragmentName = `Delete me ${Date.now()}`;
    await createFragmentViaUI(fragmentName);

    const bundle = await loadWorkspace(workspace.id);
    const fragment = bundle.fragments.find((entry) => entry.name === fragmentName);
    if (!fragment) {
      throw new Error("fragment not created");
    }

    // Open the library dialog in manage mode so the deleted section is visible
    // alongside the active fragment list (both share the same FragmentList).
    // The newly created fragment is auto-attached to the recipe, so the default
    // "insert" mode (filterMode=not_in_recipe) would hide it.
    await openLibraryDialog("manage");

    await safeClick(`[data-testid='fragment-delete-${fragment.id}']`);
    // The delete action opens a confirmation dialog that must be accepted.
    await safeClick("[data-testid='app-dialog-confirm']");

    await browser.waitUntil(
      async () => !(await $(`[data-testid='fragment-select-${fragment.id}']`).isExisting()),
      {
        timeout: 20000,
        interval: 200,
      },
    );

    await safeClick(`[data-testid='fragment-restore-${fragment.id}']`);

    await browser.waitUntil(
      async () => await $(`[data-testid='fragment-select-${fragment.id}']`).isExisting(),
      {
        timeout: 20000,
        interval: 200,
      },
    );

    await safeClick(`[data-testid='fragment-select-${fragment.id}']`);
    // Close the library dialog so its overlay doesn't block interactions.
    await safeClick("[data-testid='fragment-library-close']");
    await browser.waitUntil(
      async () => (await $("label[for='fragment-editor']").getText()).includes(fragmentName),
      {
        timeout: 20000,
        interval: 200,
      },
    );
  });
});
