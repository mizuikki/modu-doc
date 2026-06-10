import { browser, expect } from "@wdio/globals";
import { setDocumentEditorContent } from "../support/editor";
import { createAndOpenProject, loadProject } from "../support/project";
import { tauriInvoke } from "../support/tauri";
import { clickCenterMode, safeClick } from "../support/ui";

describe("History (per-document snapshots)", () => {
  it("snapshots the document, edits to v2, shows a diff, and restores v1", async () => {
    // 1. Fresh project with the default Untitled.md document already
    //    activated by the support helper.
    const projectName = `E2E Doc snapshot ${Date.now()}`;
    const { projectId, documentId } = await createAndOpenProject(projectName);

    // 2. Type v1 into the document editor and snapshot it. The snapshot
    //    binds to a single Document in the new schema (not to the
    //    project), so we pass documentId.
    await setDocumentEditorContent("v1");
    await browser.waitUntil(async () => {
      const bundle = await loadProject(projectId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      return doc?.content === "v1";
    });
    await tauriInvoke("create_snapshot", {
      documentId,
      label: "v1",
    });

    // 3. Wait for the snapshot to land and verify the snapshot text
    //    matches what was in the document at the time of creation.
    let snapshotId: string | undefined;
    await browser.waitUntil(
      async () => {
        const bundle = await loadProject(projectId);
        const list = bundle.snapshots?.[documentId] ?? [];
        const match = list.find((entry) => entry.label === "v1");
        if (match) {
          snapshotId = match.id;
          return true;
        }
        return false;
      },
      { timeout: 20000, interval: 200, timeoutMsg: "v1 snapshot not present" },
    );
    expect(snapshotId).toBeTruthy();
    {
      const bundle = await loadProject(projectId);
      const list = bundle.snapshots?.[documentId] ?? [];
      const match = list.find((entry) => entry.id === snapshotId);
      expect(match?.content).toBe("v1");
    }

    // 4. Edit the document to v2 and confirm the in-memory content
    //    actually changed before we switch to the history view.
    await setDocumentEditorContent("v2");
    await browser.waitUntil(async () => {
      const bundle = await loadProject(projectId);
      const doc = bundle.documents.find((entry) => entry.id === documentId);
      return doc?.content === "v2";
    });

    // 5. Switch the center mode to "history" and select the v1
    //    snapshot. The diff panel must render at least one diff row.
    await clickCenterMode("history");
    await safeClick(`[data-testid='history-snapshot-select-${snapshotId}']`, 20000);
    await browser.waitUntil(async () => await $("[data-testid='history-diff']").isExisting(), {
      timeout: 20000,
      interval: 200,
      timeoutMsg: "history diff panel not visible",
    });
    const rows = await $$("[data-testid^='history-diff-row-']");
    expect(rows.length).toBeGreaterThan(0);
    // Smoke: at least one row should mention v1 (the snapshot side).
    const diffText = (await $("[data-testid='history-diff']").getText()).toLowerCase();
    expect(diffText).toContain("v1");

    // 6. Restore the v1 snapshot in "overwrite" mode. The default for
    //    the per-document history restore is overwrite (see
    //    restore_snapshot's `mode` argument). After restore, the live
    //    document content should be v1 again.
    await safeClick(`[data-testid='history-snapshot-restore-${snapshotId}']`, 20000);
    await browser.waitUntil(
      async () => {
        const bundle = await loadProject(projectId);
        const doc = bundle.documents.find((entry) => entry.id === documentId);
        return doc?.content === "v1";
      },
      { timeout: 20000, interval: 200, timeoutMsg: "document content was not restored to v1" },
    );

    // 7. Switch back to edit mode and confirm the editor textarea
    //    reflects the restored content (so the editor is actually
    //    bound to the restored state, not just the DB).
    await clickCenterMode("edit");
    const textarea = await $("[data-testid='editor-pane-textarea']");
    await textarea.waitForExist({ timeout: 20000 });
    const textareaValue = await textarea.getValue();
    expect(textareaValue).toBe("v1");
  });
});
