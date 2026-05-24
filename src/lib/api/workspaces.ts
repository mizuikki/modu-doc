import { tauriInvoke } from "./tauri";
import type { WorkspaceLoadResult } from "./types";

export async function listWorkspaces() {
  return await tauriInvoke<WorkspaceLoadResult["workspace"][]>("list_workspaces");
}

export async function loadWorkspace(id: string) {
  return await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id });
}

export async function createWorkspace(args: { name: string; targetPath?: string | null }) {
  return await tauriInvoke<{ id: string; name: string }>("create_workspace", {
    name: args.name,
    targetPath: args.targetPath ?? null,
  });
}

export async function updateWorkspace(args: {
  id: string;
  name?: string | null;
  targetPath?: string | null;
  clearTargetPath?: boolean;
}) {
  await tauriInvoke("update_workspace", {
    id: args.id,
    name: args.name ?? null,
    targetPath: args.targetPath ?? null,
    clearTargetPath: args.clearTargetPath ?? false,
  });
}
