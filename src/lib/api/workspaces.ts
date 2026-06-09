import { tauriInvoke } from "./tauri";
import type { WorkspaceLoadResult, WorkspaceWire } from "./types";

export async function listWorkspaces() {
  return await tauriInvoke<WorkspaceWire[]>("list_workspaces");
}

export async function loadWorkspace(id: string) {
  return await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id });
}

export async function createWorkspace(args: { name: string; initialDocumentName?: string | null }) {
  return await tauriInvoke<WorkspaceWire>("create_workspace", {
    name: args.name,
    initialDocumentName: args.initialDocumentName ?? null,
  });
}

export async function updateWorkspace(args: { id: string; name?: string | null }) {
  return await tauriInvoke<WorkspaceWire>("update_workspace", {
    id: args.id,
    name: args.name ?? null,
  });
}

export async function deleteWorkspace(id: string) {
  await tauriInvoke("delete_workspace", { id });
}
