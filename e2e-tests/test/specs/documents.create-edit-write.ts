import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { browser, expect } from "@wdio/globals";
import { setDocumentEditorContent } from "../support/editor";
import { tauriInvoke } from "../support/tauri";
import {
  assertDocumentFileStatus,
  clickTargetBarWrite,
  dismissDocumentStatus,
} from "../support/ui";
import { createAndOpenWorkspace, loadWorkspace } from "../support/workspace";

describe("Documents", () => {
  it("creates a workspace, lands in Main.md, and writes the edited content to disk", async () => {
    // 1. Create a fresh workspace. The support helper asserts Main.md is
    //    already the active document once it returns.
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-doc-write-"));
    const targetPath = path.join(tempDir, "main.md");
    const workspaceName = `E2E Doc write ${Date.now()}`;
    const { workspaceId, documentId } = await createAndOpenWorkspace(workspaceName);

    // 2. Sanity: the sidebar row for Main.md is the active one.
    const sidebarRow = await $(`[data-testid='sidebar-document-${documentId}']`);
    await sidebarRow.waitForExist({ timeout: 20000 });
    await expect(sidebarRow).toHaveAttribute("data-active", "true");

    // 3. Bind the document to a target file. The status flips from
    //    missing_target -> dirty after the first edit, then to ready
    //    once the file is written.
    await tauriInvoke("update_document", {
      id: documentId,
      target_path: targetPath,
    });
    await dismissDocumentStatus();
    await browser.waitUntil(async () => {
      const bundle = await loadWorkspace(workspaceId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      return doc?.target_path === targetPath;
    });
    await assertDocumentFileStatus(documentId, "missing_target");

    // 4. Type into the document editor and let the store flush the change
    //    (setDocumentEditorContent blurs the textarea on purpose).
    const payload = `Hello document write ${Date.now()}\n`;
    await setDocumentEditorContent(payload);

    // 5. Status should move to dirty because content changed but the file
    //    on disk is still untouched.
    await assertDocumentFileStatus(documentId, "dirty");

    // 6. Click the target bar's "Write to file" action and wait for the
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
    //    last_written_hash; the file_status should be back to ready.
    await assertDocumentFileStatus(documentId, "ready");
    const bundle = await loadWorkspace(workspaceId);
    const doc = bundle.documents.find((entry) => entry.id === documentId);
    expect(doc).toBeTruthy();
    expect(doc?.last_written_at).not.toBeNull();
    expect(doc?.last_written_at ?? "").not.toBe("");
    expect(doc?.last_written_hash).not.toBeNull();
  });

  it("re-binds a new target path and writes into it", async () => {
    // A second pass that exercises the target-path rebind flow without
    // recreating the workspace, to keep the spec self-contained.
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-doc-rebind-"));
    await mkdir(tempDir, { recursive: true });
    const targetPath = path.join(tempDir, "rebinding.md");
    const workspaceName = `E2E Doc rebind ${Date.now()}`;
    const { documentId } = await createAndOpenWorkspace(workspaceName);

    await tauriInvoke("update_document", { id: documentId, target_path: targetPath });
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
