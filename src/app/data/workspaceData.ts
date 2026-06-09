import { type LoadResultBundle, mapLoadResult } from "@/app/workspaceMappers";
import { createWorkspace, listWorkspaces, loadWorkspace } from "@/lib/api/workspaces";
import { useAppStore } from "@/store/appStore";
import type { WorkspaceSummary } from "@/store/types";

export async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
  const list = await listWorkspaces();
  const mapped = list.map((w) => ({
    id: w.id,
    name: w.name,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));
  useAppStore.getState().setWorkspaceList(mapped);
  return mapped;
}

export async function fetchWorkspaceBundle(workspaceId: string): Promise<LoadResultBundle> {
  const load = await loadWorkspace(workspaceId);
  const mapped = mapLoadResult(load);
  useAppStore.getState().loadWorkspaceBundle(mapped);
  return mapped;
}

export async function createWorkspaceWithFirstDocument(name: string) {
  const ws = await createWorkspace({ name, initialDocumentName: "Main.md" });
  await fetchWorkspaces();
  await fetchWorkspaceBundle(ws.id);
  // After fetching the bundle the activeWorkspaceId / activeDocumentId are
  // recomputed by loadWorkspaceBundle; ensure the just-created workspace is the
  // active one even if a previous workspace is also present.
  useAppStore.getState().setActiveWorkspace(ws.id);
  return ws;
}
