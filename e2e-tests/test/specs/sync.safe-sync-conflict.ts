import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick, selectWorkspaceById } from "../support/ui";

describe("Sync", () => {
  it("safe_sync detects conflict and shows conflict banner", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-safe-sync-"));
    const targetPath = path.join(tempDir, "workspace.md");
    const workspaceName = `E2E Safe sync ${Date.now()}`;

    const workspace = await tauriInvoke<{ id: string }>("create_workspace", {
      name: workspaceName,
      targetPath,
    });
    await selectWorkspaceById(workspace.id);

    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Intro",
      content: "Intro body",
    });
    await tauriInvoke("write_target_file", {
      workspaceId: workspace.id,
      conflictPolicy: "overwrite_target",
    });

    await writeFile(targetPath, "External change\n", "utf8");

    // Trigger safe sync through Save shortcut handler (Ctrl/Cmd+S).
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await browser.keys([modifier, "s"]);

    await browser.waitUntil(async () => await $("[data-testid='conflict-banner']").isExisting(), {
      timeout: 40000,
      interval: 250,
    });

    const after = await readFile(targetPath, "utf8");
    expect(after).toContain("External change");
  });

  it("overwrite target resolution respects confirm cancel", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-overwrite-cancel-"));
    const targetPath = path.join(tempDir, "workspace.md");
    const workspaceName = `E2E Overwrite cancel ${Date.now()}`;

    const workspace = await tauriInvoke<{ id: string }>("create_workspace", {
      name: workspaceName,
      targetPath,
    });
    await selectWorkspaceById(workspace.id);

    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Intro",
      content: "Intro body",
    });
    await tauriInvoke("write_target_file", {
      workspaceId: workspace.id,
      conflictPolicy: "overwrite_target",
    });
    await writeFile(targetPath, "External change\n", "utf8");

    await browser.waitUntil(async () => await $("[data-testid='conflict-banner']").isExisting(), {
      timeout: 40000,
      interval: 250,
    });

    await safeClick("[data-testid='conflict-overwrite-target']", 40000);
    await safeClick("[data-testid='app-dialog-cancel']", 20000);

    // Target should remain unchanged after cancel.
    const after = await readFile(targetPath, "utf8");
    expect(after).toContain("External change");
  });
});
