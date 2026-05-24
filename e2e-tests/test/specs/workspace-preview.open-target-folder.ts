import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { safeClick } from "../support/ui";
import { createAndSelectWorkspace } from "../support/workspace";

describe("Workspace preview", () => {
  it("open target folder action does not error", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-open-target-"));
    const targetPath = path.join(tempDir, "workspace.md");
    await writeFile(targetPath, "# Hello\n", "utf8");

    const workspaceName = `E2E Open target ${Date.now()}`;
    await createAndSelectWorkspace({ name: workspaceName, targetPath });

    await safeClick("[data-testid='main-tab-preview']");
    await safeClick("[data-testid='preview-open-target-folder']");

    // Best-effort smoke check: ensure the app is still responsive after invoking.
    await safeClick("[data-testid='main-tab-edit']");
  });
});
