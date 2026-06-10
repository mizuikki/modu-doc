import { browser, expect } from "@wdio/globals";
import { createAndOpenProject, loadProject } from "../support/project";
import { tauriInvoke } from "../support/tauri";

/**
 * The old `preview-open-target-folder` testid and the preview tab are
 * gone. The "open target folder" action is now exposed only as the
 * `open_target_in_file_manager` tauri command (which the target bar
 * uses). The backend short-circuits to OK when
 * `MODUDOC_E2E_SKIP_REVEAL=1` is set, so we don't actually pop a file
 * manager window during e2e.
 */
describe("Project preview", () => {
  it("open target folder action does not error", async () => {
    const projectName = `E2E Open target ${Date.now()}`;
    const { projectId, documentId } = await createAndOpenProject(projectName);

    // Bind a target path on the active document so the backend has
    // something to look up. (Without a target_path the command returns
    // `invalid_target_path`.)
    const targetPath = `/tmp/modudoc-e2e-open-target-${Date.now()}.md`;
    await tauriInvoke("update_document", {
      request: {
        id: documentId,
        targetPath,
      },
    });
    await browser.waitUntil(async () => {
      const bundle = await loadProject(projectId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      return doc?.target_path === targetPath;
    });

    // Drive the command directly. With MODUDOC_E2E_SKIP_REVEAL=1 it
    // returns Ok(()) without opening a file manager window. We assert
    // it resolves without throwing.
    await tauriInvoke("open_target_in_file_manager", { documentId });

    // Smoke: app is still responsive.
    await expect($("header")).toBeDisplayed();
    await expect($(`[data-testid='sidebar-document-${documentId}']`)).toHaveAttribute(
      "data-active",
      "true",
    );
  });
});
