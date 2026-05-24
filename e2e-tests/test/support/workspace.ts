import { browser, expect } from "@wdio/globals";
import { tauriInvoke } from "./tauri";
import { safeClick, selectWorkspaceById } from "./ui";

export type WorkspaceLoadResult = {
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
  snapshots?: Array<{
    id: string;
    workspace_id: string;
    recipe_id: string;
    label: string;
    snapshot_json: string;
    compiled_text: string;
    compiled_hash: string;
    created_at: string;
  }>;
};

export async function createAndSelectWorkspace(args: { name: string; targetPath?: string | null }) {
  const workspace = await tauriInvoke<WorkspaceLoadResult["workspace"]>("create_workspace", {
    name: args.name,
    targetPath: args.targetPath ?? null,
  });

  await browser.waitUntil(async () => await $("#workspace-select").isExisting(), {
    timeout: 20000,
    interval: 200,
  });

  await selectWorkspaceById(workspace.id);
  await browser.waitUntil(async () => (await $("#workspace-select").getValue()) === workspace.id, {
    timeout: 20000,
    interval: 200,
  });

  await safeClick("[data-testid='main-tab-edit']", 20000);

  expect(workspace.id).toBeTruthy();
  return workspace;
}

export async function loadWorkspace(workspaceId: string) {
  return await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id: workspaceId });
}

export async function deleteWorkspace(workspaceId: string) {
  await tauriInvoke("delete_workspace", { id: workspaceId });
}
