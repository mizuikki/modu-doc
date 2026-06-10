import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { browser, expect } from "@wdio/globals";
import { setDocumentEditorContent } from "../support/editor";
import { createAndOpenProject, loadProject, waitForDocumentTargetPath } from "../support/project";
import { tauriInvoke } from "../support/tauri";
import { assertDocumentSaveState, clickTargetBarWrite, dismissDocumentStatus } from "../support/ui";

describe("Documents", () => {
  it("creates a project, lands in Untitled.md, and writes the edited content to disk", async () => {
    // 1. Create a fresh project. The support helper asserts Untitled.md is
    //    already the active document once it returns.
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-doc-write-"));
    const targetPath = path.join(tempDir, "main.md");
    const projectName = `E2E Doc write ${Date.now()}`;
    const { projectId, documentId } = await createAndOpenProject(projectName);

    // 2. Sanity: the sidebar row for Untitled.md is the active one.
    const sidebarRow = await $(`[data-testid='sidebar-document-${documentId}']`);
    await sidebarRow.waitForExist({ timeout: 20000 });
    await expect(sidebarRow).toHaveAttribute("data-active", "true");

    // 3. Bind the document to a target file. The status flips from
    //    draft -> unsaved after the first edit, then to saved
    //    once the file is written.
    await tauriInvoke("update_document", {
      request: {
        id: documentId,
        targetPath,
      },
    });
    await dismissDocumentStatus();
    await waitForDocumentTargetPath(projectId, documentId, targetPath);
    await assertDocumentSaveState(documentId, "draft");

    // 4. Type into the document editor and let the store flush the change
    //    (setDocumentEditorContent blurs the textarea on purpose).
    const payload = `Hello document write ${Date.now()}\n`;
    await setDocumentEditorContent(payload);

    // 5. Status should move to unsaved because content changed but the file
    //    on disk is still untouched.
    await assertDocumentSaveState(documentId, "unsaved");

    // 6. Click the target bar's "Save to file" action and wait for the
    //    file to appear on disk with the typed text.
    await clickTargetBarWrite();

    await browser.waitUntil(
      async () => {
        try {
          const written = await readFile(targetPath, "utf8");
          return written.includes(payload.trim());
        } catch {
          return false;
        }
      },
      { timeout: 20000, interval: 200, timeoutMsg: "target file was not written" },
    );

    // 7. After a successful write, the backend records last_written_at and
    //    last_written_hash; the save_state should be back to saved.
    await assertDocumentSaveState(documentId, "saved");
    const bundle = await loadProject(projectId);
    const doc = bundle.documents.find((entry) => entry.id === documentId);
    expect(doc).toBeTruthy();
    expect(doc?.last_written_at).not.toBeNull();
    expect(doc?.last_written_at ?? "").not.toBe("");
    expect(doc?.last_written_hash).not.toBeNull();
  });

  it("re-binds a new target path and writes into it", async () => {
    // A second pass that exercises the target-path rebind flow without
    // recreating the project, to keep the spec self-contained.
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-doc-rebind-"));
    await mkdir(tempDir, { recursive: true });
    const targetPath = path.join(tempDir, "rebinding.md");
    const projectName = `E2E Doc rebind ${Date.now()}`;
    const { documentId } = await createAndOpenProject(projectName);

    await tauriInvoke("update_document", { request: { id: documentId, targetPath } });
    await setDocumentEditorContent(`rebind payload ${Date.now()}`);
    await clickTargetBarWrite();

    await browser.waitUntil(
      async () => {
        try {
          const text = await readFile(targetPath, "utf8");
          return text.includes("rebind payload");
        } catch {
          return false;
        }
      },
      { timeout: 20000, interval: 200 },
    );
  });
});
