import { browser, expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick, safeSetValue } from "../support/ui";
import { createAndOpenWorkspace, loadWorkspace } from "../support/workspace";

/**
 * Global search now has 5 result kinds: workspace, document, fragment,
 * recipe, snapshot. The new "document" kind activates a document via
 * `setActiveDocument` and flips the center mode to "edit". This spec
 * exercises all 4 non-workspace kinds: document, fragment, recipe, snapshot.
 */
describe("Global search", () => {
  it("navigates to document, fragment, recipe, and snapshot results", async () => {
    const keyword = `nav-key-${Date.now()}`;
    const workspaceName = `E2E Search Nav ${keyword}`;
    const { workspaceId, documentId } = await createAndOpenWorkspace(workspaceName);

    // 1. Create a second document inside the workspace so we can exercise
    //    the new "document" search result kind. The new document gets its
    //    own id and is searchable by name.
    const extraDocName = `Doc ${keyword}`;
    const extraDoc = await tauriInvoke<{ id: string; workspace_id: string }>("create_document", {
      workspaceId,
      name: extraDocName,
      content: `body for search ${keyword}`,
    });
    expect(extraDoc.id).toBeTruthy();

    // 2. Create a fragment, recipe, and snapshot. All three are searchable
    //    by their name/label.
    const fragmentName = `Fragment ${keyword}`;
    const fragment = await tauriInvoke<{ id: string }>("create_fragment", {
      workspaceId,
      name: fragmentName,
      content: `content ${keyword}`,
    });
    expect(fragment.id).toBeTruthy();

    const recipeName = `Recipe ${keyword}`;
    const recipe = await tauriInvoke<{ id: string }>("create_recipe", {
      workspaceId,
      name: recipeName,
      description: "",
    });
    expect(recipe.id).toBeTruthy();

    const snapshot = await tauriInvoke<{ id: string }>("create_snapshot", {
      documentId,
      label: `Snap ${keyword}`,
    });
    expect(snapshot.id).toBeTruthy();

    // 3. Drive the search input. The new "document" result must appear
    //    alongside the other 3 kinds; the spec asserts all 4 result
    //    testids are visible before clicking any of them.
    await safeSetValue("[data-testid='global-search-input']", keyword);
    const expectedTestids = [
      `[data-testid='global-search-result-document-${extraDoc.id}']`,
      `[data-testid='global-search-result-fragment-${fragment.id}']`,
      `[data-testid='global-search-result-recipe-${recipe.id}']`,
      `[data-testid='global-search-result-snapshot-${snapshot.id}']`,
    ];
    await browser.waitUntil(
      async () => {
        const found = await Promise.all(
          expectedTestids.map(async (selector) => await $(selector).isExisting()),
        );
        return found.every(Boolean);
      },
      { timeout: 20000, interval: 200, timeoutMsg: "not all 4 result testids visible" },
    );

    // 4. Click the document result: the center mode must flip to "edit"
    //    and the sidebar row for that document must become active.
    await safeClick(`[data-testid='global-search-result-document-${extraDoc.id}']`);
    await browser.waitUntil(
      async () =>
        (await $("[data-testid='document-header-mode-edit']").getAttribute("data-active")) ===
        "true",
      { timeout: 20000, interval: 200, timeoutMsg: "document header mode did not flip to edit" },
    );
    await expect($(`[data-testid='sidebar-document-${extraDoc.id}']`)).toHaveAttribute(
      "data-active",
      "true",
    );

    // 5. Click the fragment result: the search panel closes and the
    //    app stays responsive. The fragment/recipe results drive a
    //    `setRightPanelTab` action, but the right panel is still a
    //    placeholder in this refactor; we just assert the click was
    //    accepted and the search input cleared.
    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`[data-testid='global-search-result-fragment-${fragment.id}']`);
    await browser.waitUntil(
      async () => (await $("[data-testid='global-search-input']").getValue()) === "",
      {
        timeout: 20000,
        interval: 200,
        timeoutMsg: "search input not cleared after fragment click",
      },
    );

    // 6. Click the recipe result: same — the click is accepted, the
    //    search input clears.
    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`[data-testid='global-search-result-recipe-${recipe.id}']`);
    await browser.waitUntil(
      async () => (await $("[data-testid='global-search-input']").getValue()) === "",
      { timeout: 20000, interval: 200, timeoutMsg: "search input not cleared after recipe click" },
    );

    // 7. Click the snapshot result: the center mode should switch to
    //    "history" and the snapshot row should be visible in the
    //    history timeline.
    await safeSetValue("[data-testid='global-search-input']", keyword);
    await safeClick(`[data-testid='global-search-result-snapshot-${snapshot.id}']`);
    await browser.waitUntil(
      async () =>
        (await $("[data-testid='document-header-mode-history']").getAttribute("data-active")) ===
        "true",
      { timeout: 20000, interval: 200, timeoutMsg: "center mode did not flip to history" },
    );
    await expect($(`[data-testid='history-snapshot-select-${snapshot.id}']`)).toBeDisplayed();

    // 8. Sanity: the original auto-created Main.md is still present and
    //    the bundle is consistent.
    const finalBundle = await loadWorkspace(workspaceId);
    const initialDoc = finalBundle.documents.find((entry) => entry.id === documentId);
    expect(initialDoc).toBeTruthy();
  });
});
