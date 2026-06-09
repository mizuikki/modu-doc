import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { browser, expect } from "@wdio/globals";
import { setDocumentEditorContent } from "../support/editor";
import { tauriInvoke } from "../support/tauri";
import {
  assertDocumentFileStatus,
  clickConflictPolicy,
  clickTargetBarWrite,
  dismissDocumentStatus,
  safeClick,
  waitForTargetBarConflict,
} from "../support/ui";
import { createAndOpenWorkspace, loadWorkspace } from "../support/workspace";

/**
 * Bind the active document to a target file, type some content, and
 * perform the initial write so the backend records a last_written_hash.
 * Returns the absolute target path so the spec can decide what to do next.
 */
async function bindSeedAndWrite(
  documentId: string,
  workspaceId: string,
  targetPath: string,
  initialContent: string,
) {
  await tauriInvoke("update_document", { id: documentId, target_path: targetPath });
  await browser.waitUntil(async () => {
    const bundle = await loadWorkspace(workspaceId);
    const doc = bundle.documents.find((entry) => entry.id === documentId);
    return doc?.target_path === targetPath;
  });
  await assertDocumentFileStatus(documentId, "missing_target");

  await setDocumentEditorContent(initialContent);
  await assertDocumentFileStatus(documentId, "dirty");
  await clickTargetBarWrite();
  await assertDocumentFileStatus(documentId, "ready");

  // Sanity: last_written_hash must be populated so that a subsequent
  // external edit will be detected as a conflict.
  await browser.waitUntil(async () => {
    const bundle = await loadWorkspace(workspaceId);
    const doc = bundle.documents.find((entry) => entry.id === documentId);
    return Boolean(doc?.last_written_hash);
  });
}

async function triggerConflictViaWrite() {
  // The target bar write path is the canonical way to surface the
  // conflict dialog (the backend re-hashes the file and notices the
  // mismatch). The button stays clickable so the click is enough.
  await clickTargetBarWrite();
  await waitForTargetBarConflict();
}

describe("Documents — external conflict", () => {
  it("surfaces the conflict bar and resolves with each of the four policies", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-conflict-"));
    await mkdir(tempDir, { recursive: true });
    const targetPath = path.join(tempDir, "conflict.md");
    const workspaceName = `E2E Conflict ${Date.now()}`;
    const { workspaceId, documentId } = await createAndOpenWorkspace(workspaceName);

    const original = `original content ${Date.now()}`;
    await bindSeedAndWrite(documentId, workspaceId, targetPath, original);

    // Externally modify the file so the next write detects a conflict.
    const externalPayload = `EXTERNAL EDIT ${Date.now()}\n`;
    await writeFile(targetPath, externalPayload, "utf8");

    await triggerConflictViaWrite();
    await assertDocumentFileStatus(documentId, "conflicted");

    // ---- Policy 1: import_external ----
    // The document content should now equal the external file content,
    // and the file on disk is left untouched. Status becomes dirty
    // because content moved off the on-disk version.
    await safeClick("[data-testid='target-bar-resolve-import_external']", 20000);
    await browser.waitUntil(async () => {
      const bundle = await loadWorkspace(workspaceId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      return doc?.file_status === "dirty";
    });
    {
      const bundle = await loadWorkspace(workspaceId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      expect(doc?.content).toBe(externalPayload);
    }
    expect(await readFile(targetPath, "utf8")).toBe(externalPayload);

    // Reset for the next policy: write a fresh known content to the
    // document, then mutate the file externally again.
    await dismissDocumentStatus();
    await setDocumentEditorContent(`second pass ${Date.now()}`);
    await clickTargetBarWrite();
    await assertDocumentFileStatus(documentId, "ready");
    const externalPayload2 = `EXTERNAL EDIT 2 ${Date.now()}\n`;
    await writeFile(targetPath, externalPayload2, "utf8");
    await triggerConflictViaWrite();
    await assertDocumentFileStatus(documentId, "conflicted");

    // ---- Policy 2: overwrite_external ----
    // The on-disk file is replaced with the document content. Status
    // becomes ready and the file no longer contains the external text.
    await safeClick("[data-testid='target-bar-resolve-overwrite_external']", 20000);
    await assertDocumentFileStatus(documentId, "ready");
    {
      const after = await readFile(targetPath, "utf8");
      expect(after).not.toBe(externalPayload2);
      expect(after).toContain("second pass");
    }

    // Reset for the backup policy.
    await dismissDocumentStatus();
    await setDocumentEditorContent(`third pass ${Date.now()}`);
    await clickTargetBarWrite();
    await assertDocumentFileStatus(documentId, "ready");
    const externalPayload3 = `EXTERNAL EDIT 3 ${Date.now()}\n`;
    await writeFile(targetPath, externalPayload3, "utf8");
    await triggerConflictViaWrite();
    await assertDocumentFileStatus(documentId, "conflicted");

    // ---- Policy 3: backup_and_overwrite ----
    // A timestamped .bak file is created next to the target, the target
    // is overwritten with the document content, and the conflict clears.
    await safeClick("[data-testid='target-bar-resolve-backup_and_overwrite']", 20000);
    await assertDocumentFileStatus(documentId, "ready");
    {
      const entries = await readdir(tempDir);
      const backupName = entries.find(
        (entry) => entry.startsWith("conflict.") && entry.endsWith(externalPayload3.slice(0, 1)),
      );
      expect(backupName).toBeTruthy();
      const backupFile = path.join(tempDir, backupName ?? "");
      const backupBody = await readFile(backupFile, "utf8");
      expect(backupBody).toBe(externalPayload3);
      const after = await readFile(targetPath, "utf8");
      expect(after).toContain("third pass");
    }

    // Reset for the cancel policy.
    await dismissDocumentStatus();
    await setDocumentEditorContent(`fourth pass ${Date.now()}`);
    await clickTargetBarWrite();
    await assertDocumentFileStatus(documentId, "ready");
    const externalPayload4 = `EXTERNAL EDIT 4 ${Date.now()}\n`;
    await writeFile(targetPath, externalPayload4, "utf8");
    await triggerConflictViaWrite();
    await assertDocumentFileStatus(documentId, "conflicted");

    // ---- Policy 4: cancel ----
    // The conflict bar is dismissed, file on disk is preserved, and
    // document content is left untouched.
    await safeClick("[data-testid='target-bar-resolve-cancel']", 20000);
    await browser.waitUntil(async () => {
      const bar = await $("[data-testid='target-bar-conflict']");
      return !(await bar.isExisting());
    });
    {
      const onDisk = await readFile(targetPath, "utf8");
      expect(onDisk).toBe(externalPayload4);
    }
    {
      const bundle = await loadWorkspace(workspaceId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      // The backend keeps the document content under the user's edits
      // (cancel means "leave my work intact"). The status moves to
      // dirty because the on-disk hash no longer matches.
      expect(doc?.content).toContain("fourth pass");
    }

    // Helper to make sure the policy helper signature lines up with the
    // new spec (clickConflictPolicy exists in support/ui).
    await clickConflictPolicy("cancel").catch(() => {
      // no conflict bar present at this point; the click would no-op.
    });
  });
});
