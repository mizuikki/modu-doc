import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Sync", () => {
  it("backs up and overwrites the target after external changes", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-backup-"));
    const targetPath = path.join(tempDir, "workspace.md");
    const workspaceName = `E2E Backup ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath });

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

    await safeClick("[data-testid='conflict-backup-then-overwrite']", 40000);

    await browser.waitUntil(
      async () => (await readFile(targetPath, "utf8")).includes("Intro body"),
      {
        timeout: 40000,
        interval: 250,
      },
    );

    const entries = await readdir(tempDir);
    expect(entries.some((name) => name.startsWith("workspace.") && name.endsWith(".bak"))).toBe(
      true,
    );
  });
});
