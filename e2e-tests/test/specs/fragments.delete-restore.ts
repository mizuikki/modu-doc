import { browser, expect } from "@wdio/globals";
import { createAndOpenProject, loadProject } from "../support/project";
import { tauriInvoke } from "../support/tauri";

/**
 * Fragments are now a content-copy material library. The fragment list lives
 * in the right-panel "Fragments" tab; the helper that drove the old library
 * dialog (`createFragmentViaUI` / `openLibraryDialog`) is gone. We exercise
 * the create / soft-delete / restore flow entirely through tauriInvoke and
 * assert against load_project, which is the source of truth for fragment
 * state.
 */
describe("Fragments", () => {
  it("soft-deletes and restores a fragment via tauri commands", async () => {
    const projectName = `E2E Fragment delete ${Date.now()}`;
    const { projectId } = await createAndOpenProject(projectName);

    // 1. Create a fragment directly through the backend. The wire response
    //    shape includes `deleted_at: null`; we re-fetch via load_project
    //    for the canonical state.
    const fragmentName = `Delete me ${Date.now()}`;
    const created = await tauriInvoke<{ id: string }>("create_fragment", {
      projectId,
      name: fragmentName,
      content: "material to be archived",
    });
    expect(created.id).toBeTruthy();
    const fragmentId = created.id;

    // 2. Confirm the fragment landed in the project bundle and is active
    //    (deleted_at is null). The bundle is the source of truth.
    await browser.waitUntil(
      async () => {
        const bundle = await loadProject(projectId);
        const match = bundle.fragments.find((entry) => entry.id === fragmentId);
        return Boolean(match) && match?.deleted_at === null;
      },
      { timeout: 20000, interval: 200, timeoutMsg: "fragment not present in bundle" },
    );

    // 3. Soft-delete the fragment. The row stays in the table but
    //    `deleted_at` is set; it should disappear from the active list
    //    surface in the UI.
    await tauriInvoke("soft_delete_fragment", { id: fragmentId });
    await browser.waitUntil(
      async () => {
        const bundle = await loadProject(projectId);
        const match = bundle.fragments.find((entry) => entry.id === fragmentId);
        return match?.deleted_at !== null && match?.deleted_at !== undefined;
      },
      { timeout: 20000, interval: 200, timeoutMsg: "fragment was not soft-deleted" },
    );

    // 4. Restore the fragment. `deleted_at` should clear back to null.
    await tauriInvoke("restore_fragment", { id: fragmentId });
    await browser.waitUntil(
      async () => {
        const bundle = await loadProject(projectId);
        const match = bundle.fragments.find((entry) => entry.id === fragmentId);
        return match?.deleted_at === null;
      },
      { timeout: 20000, interval: 200, timeoutMsg: "fragment was not restored" },
    );

    // 5. Sanity: the name + content we created survived the round-trip.
    const finalBundle = await loadProject(projectId);
    const restored = finalBundle.fragments.find((entry) => entry.id === fragmentId);
    expect(restored?.name).toBe(fragmentName);
    expect(restored?.content).toBe("material to be archived");
  });
});
