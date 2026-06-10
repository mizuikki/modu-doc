import { tauriInvoke } from "./tauri";
import type { ProjectLoadResult, ProjectWire } from "./types";

export async function listProjects() {
  return await tauriInvoke<ProjectWire[]>("list_projects");
}

export async function loadProject(id: string) {
  return await tauriInvoke<ProjectLoadResult>("load_project", { id });
}

export async function createProject(args: { name: string; initialDocumentName?: string | null }) {
  return await tauriInvoke<ProjectWire>("create_project", {
    name: args.name,
    initialDocumentName: args.initialDocumentName ?? null,
  });
}

export async function updateProject(args: { id: string; name?: string | null }) {
  return await tauriInvoke<ProjectWire>("update_project", {
    id: args.id,
    name: args.name ?? null,
  });
}

export async function deleteProject(id: string) {
  await tauriInvoke("delete_project", { id });
}
