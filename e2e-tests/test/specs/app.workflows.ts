import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { browser, expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import {
  dismissWorkspaceStatus,
  safeClick,
  safeSetValue,
  selectWorkspaceById,
} from "../support/ui";

type WorkspaceLoadResult = {
  workspace: {
    id: string;
    name: string;
    target_path: string | null;
    default_recipe_id: string | null;
    status: string;
    last_compiled_at: string | null;
    last_compiled_hash: string | null;
    created_at: string;
    updated_at: string;
  };
  fragments: Array<{
    id: string;
    workspace_id: string;
    name: string;
    content: string;
    content_hash: string;
    sort_order: number;
    is_archived: boolean;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  recipes: Array<{
    id: string;
    workspace_id: string;
    name: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  recipe_items: Array<{
    id: string;
    recipe_id: string;
    fragment_id: string;
    enabled: boolean;
    sort_order: number;
  }>;
};

async function getWorkspaceCount(): Promise<number> {
  return (await browser.execute(
    () => (document.querySelectorAll("#workspace-select option").length ?? 0) as number,
  )) as number;
}

describe("ModuDoc workflows", () => {
  it("creates a workspace, assembles fragments, writes the target, and orders items", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-"));
    const targetPath = path.join(tempDir, "workspace.md");
    const exportPath = path.join(tempDir, "workspace.agentpack");
    const workspaceName = `E2E Workspace ${Date.now()}`;
    await safeClick("[data-testid='sidebar-new-workspace']");
    await safeSetValue("[data-testid='app-prompt-input']", workspaceName);
    await safeClick("[data-testid='app-dialog-confirm']");

    await browser.waitUntil(async () => {
      const workspaces = await tauriInvoke<WorkspaceLoadResult["workspace"][]>("list_workspaces");
      return workspaces.some((workspace) => workspace.name === workspaceName);
    });

    const workspaces = await tauriInvoke<WorkspaceLoadResult["workspace"][]>("list_workspaces");
    const workspace = workspaces.find((entry) => entry.name === workspaceName);
    expect(workspace).toBeTruthy();
    if (!workspace) {
      throw new Error("workspace not created");
    }

    await dismissWorkspaceStatus();
    await safeSetValue("[data-testid='global-search-input']", workspaceName);
    const searchResult = await $(`button*=${workspaceName}`);
    await browser.waitUntil(async () => await searchResult.isDisplayed());
    await safeClick(`button*=${workspaceName}`);
    await browser.waitUntil(async () => (await $("#workspace-select").getValue()) === workspace.id);

    await tauriInvoke("update_workspace", {
      id: workspace.id,
      name: null,
      targetPath: targetPath,
    });

    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Intro",
      content: "Intro body",
    });
    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Outro",
      content: "Outro body",
    });
    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Middle",
      content: "Middle body",
    });

    await browser.waitUntil(async () => {
      const refreshed = await tauriInvoke<WorkspaceLoadResult>("load_workspace", {
        id: workspace.id,
      });
      return (
        refreshed.fragments.some((fragment) => fragment.name === "Intro") &&
        refreshed.fragments.some((fragment) => fragment.name === "Outro")
      );
    });

    const bundle = await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id: workspace.id });
    const activeRecipe =
      bundle.recipes.find((recipe) => recipe.is_active) ?? bundle.recipes[0] ?? null;
    expect(activeRecipe).not.toBeNull();

    const fragmentByName = new Map(bundle.fragments.map((fragment) => [fragment.name, fragment]));
    const recipeItemByFragmentId = new Map(
      bundle.recipe_items
        .filter((item) => item.recipe_id === activeRecipe?.id)
        .map((item) => [item.fragment_id, item]),
    );
    const intro = fragmentByName.get("Intro");
    const middle = fragmentByName.get("Middle");
    const outro = fragmentByName.get("Outro");
    expect(intro).toBeTruthy();
    expect(middle).toBeTruthy();
    expect(outro).toBeTruthy();
    if (!intro || !middle || !outro) {
      throw new Error("fragments not created");
    }
    const introItem = recipeItemByFragmentId.get(intro.id);
    const middleItem = recipeItemByFragmentId.get(middle.id);
    const outroItem = recipeItemByFragmentId.get(outro.id);
    if (!introItem || !middleItem || !outroItem) {
      throw new Error("recipe items not created");
    }

    await tauriInvoke("update_recipe_items", {
      recipeId: activeRecipe?.id,
      items: [
        {
          ...introItem,
          sort_order: 0,
          enabled: true,
        },
        {
          ...middleItem,
          sort_order: 1,
          enabled: true,
        },
        {
          ...outroItem,
          sort_order: 2,
          enabled: false,
        },
      ],
    });

    await browser.waitUntil(async () => {
      const refreshed = await tauriInvoke<WorkspaceLoadResult>("load_workspace", {
        id: workspace.id,
      });
      const activeItems = refreshed.recipe_items.filter(
        (item) => item.recipe_id === activeRecipe?.id,
      );
      return activeItems.some((item) => item.fragment_id === outro.id && item.enabled === false);
    });

    await tauriInvoke("write_target_file", {
      workspaceId: workspace.id,
      conflictPolicy: "overwrite_target",
    });

    const written = await readFile(targetPath, "utf8");
    expect(written).toContain("Intro body");
    expect(written).toContain("Middle body");
    expect(written).not.toContain("Outro body");

    const beforeCount = await getWorkspaceCount();
    await tauriInvoke("export_workspace", {
      workspaceId: workspace.id,
      options: { path: exportPath },
    });
    expect((await stat(exportPath)).isFile()).toBe(true);
    await tauriInvoke("import_workspace_package", { path: exportPath });

    await browser.waitUntil(async () => (await getWorkspaceCount()) === beforeCount + 1);
  });

  it("detects external target edits and can import the conflict as a fragment", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-conflict-"));
    const targetPath = path.join(tempDir, "workspace.md");
    const workspaceName = `E2E Conflict ${Date.now()}`;

    const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
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

    const importBtn = await $("button*=Import as fragment");
    await importBtn.waitForExist({ timeout: 40000 });
    await safeClick("button*=Import as fragment", 40000);

    await browser.waitUntil(
      async () => {
        const refreshed = await tauriInvoke<WorkspaceLoadResult>("load_workspace", {
          id: workspace.id,
        });
        return refreshed.fragments.some((fragment) => fragment.name.includes("Imported"));
      },
      { timeout: 40000, interval: 250 },
    );
  });

  it("can overwrite the target after an external conflict", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-overwrite-"));
    const targetPath = path.join(tempDir, "workspace.md");
    const workspaceName = `E2E Overwrite ${Date.now()}`;

    const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
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

    const overwriteBtn = await $("button*=Overwrite target");
    await overwriteBtn.waitForExist({ timeout: 40000 });
    await safeClick("button*=Overwrite target", 40000);
    await safeClick("[data-testid='app-dialog-confirm']", 20000);

    await browser.waitUntil(
      async () => {
        const written = await readFile(targetPath, "utf8");
        return written.includes("Intro body");
      },
      { timeout: 40000, interval: 250 },
    );
  });

  it("rejects invalid target paths and supports clearing target", async () => {
    const workspaceName = `E2E Invalid target ${Date.now()}`;
    const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
      name: workspaceName,
      targetPath: null,
    });
    await selectWorkspaceById(workspace.id);

    await expect(
      tauriInvoke("update_workspace", {
        id: workspace.id,
        name: null,
        targetPath: path.join(os.tmpdir(), "bad.txt"),
      }),
    ).rejects.toThrow(/invalid_target_path/i);

    await tauriInvoke("update_workspace", {
      id: workspace.id,
      name: null,
      targetPath: "",
      clearTargetPath: true,
    });

    const refreshed = await tauriInvoke<WorkspaceLoadResult>("load_workspace", {
      id: workspace.id,
    });
    expect(refreshed.workspace.target_path).toBeNull();
  });

  it("creates and restores snapshots", async () => {
    const workspaceName = `E2E Snapshot ${Date.now()}`;

    const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
      name: workspaceName,
      targetPath: null,
    });
    await selectWorkspaceById(workspace.id);

    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Intro",
      content: "v1",
    });

    const snapshot = await tauriInvoke("create_snapshot", {
      workspaceId: workspace.id,
      label: "v1",
    });

    const bundle = await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id: workspace.id });
    const intro = bundle.fragments.find((fragment) => fragment.name === "Intro");
    if (!intro) throw new Error("intro fragment missing");

    await tauriInvoke("update_fragment", { id: intro.id, name: intro.name, content: "v2" });
    await browser.waitUntil(
      async () => {
        const refreshed = await tauriInvoke<WorkspaceLoadResult>("load_workspace", {
          id: workspace.id,
        });
        const refreshedIntro = refreshed.fragments.find((fragment) => fragment.id === intro.id);
        return refreshedIntro?.content === "v2";
      },
      { timeout: 20000, interval: 250 },
    );

    await tauriInvoke("restore_snapshot", { snapshotId: snapshot.id });
    await browser.waitUntil(
      async () => {
        const refreshed = await tauriInvoke<WorkspaceLoadResult>("load_workspace", {
          id: workspace.id,
        });
        const refreshedIntro = refreshed.fragments.find((fragment) => fragment.name === "Intro");
        return refreshedIntro?.content === "v1";
      },
      { timeout: 20000, interval: 250 },
    );
  });

  it("updates workspace settings via dialog", async () => {
    const workspaceName = `E2E Settings ${Date.now()}`;
    const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
      name: workspaceName,
      targetPath: null,
    });
    await selectWorkspaceById(workspace.id);

    await safeClick("button*=Workspace settings");
    await safeSetValue("[data-testid='workspace-settings-name']", `${workspaceName} Updated`);
    await safeClick("[data-testid='workspace-settings-save']");

    await browser.waitUntil(async () => {
      const workspaces = await tauriInvoke<WorkspaceLoadResult["workspace"][]>("list_workspaces");
      return workspaces.some((entry) => entry.name.includes("Updated"));
    });
  });

  it("searches across workspaces in the UI", async () => {
    const workspaceA = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
      name: `E2E Search A ${Date.now()}`,
      targetPath: null,
    });
    const workspaceB = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
      name: `E2E Search B ${Date.now()}`,
      targetPath: null,
    });
    await tauriInvoke("create_fragment", {
      workspaceId: workspaceA.id,
      name: "Alpha",
      content: "shared-keyword",
    });
    await tauriInvoke("create_fragment", {
      workspaceId: workspaceB.id,
      name: "Beta",
      content: "shared-keyword",
    });

    await dismissWorkspaceStatus();
    await safeSetValue("[data-testid='global-search-input']", "shared-keyword");
    const alphaResult = await $("button*=Alpha");
    const betaResult = await $("button*=Beta");
    await browser.waitUntil(
      async () => (await alphaResult.isDisplayed()) && (await betaResult.isDisplayed()),
    );
  });

  it("rejects invalid agentpack imports", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-agentpack-"));
    const badPack = path.join(tempDir, "bad.agentpack");
    await writeFile(badPack, "not a zip", "utf8");

    await expect(tauriInvoke("import_workspace_package", { path: badPack })).rejects.toThrow();
  });

  it("smoke tests locale toggle between English and Chinese", async () => {
    await dismissWorkspaceStatus();
    await safeClick("button*=EN");
    await browser.waitUntil(async () => (await $("button*=ZH")).isExisting());
    await safeClick("button*=ZH");
    await browser.waitUntil(async () => (await $("button*=EN")).isExisting());
  });

  it("fails to write to a not-writable target path (linux)", async function () {
    if (process.platform !== "linux") {
      this.skip();
    }
    const workspaceName = `E2E Unwritable ${Date.now()}`;
    const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
      name: workspaceName,
      targetPath: "/proc/modudoc-e2e.md",
    });
    await selectWorkspaceById(workspace.id);

    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Intro",
      content: "Intro body",
    });

    await expect(
      tauriInvoke("write_target_file", {
        workspaceId: workspace.id,
        conflictPolicy: "overwrite_target",
      }),
    ).rejects.toThrow(/target_not_writable|target_missing|permission/i);

    try {
      await chmod("/proc/modudoc-e2e.md", 0o644);
    } catch {
      // ignore
    }
  });
});
