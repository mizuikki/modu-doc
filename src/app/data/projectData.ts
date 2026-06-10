import { type LoadResultBundle, mapLoadResult } from "@/app/projectMappers";
import { createProject, listProjects, loadProject } from "@/lib/api/projects";
import { useAppStore } from "@/store/appStore";
import type { ProjectSummary } from "@/store/types";

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const list = await listProjects();
  const mapped = list.map((w) => ({
    id: w.id,
    name: w.name,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));
  useAppStore.getState().setProjectList(mapped);
  return mapped;
}

export async function fetchProjectBundle(projectId: string): Promise<LoadResultBundle> {
  const load = await loadProject(projectId);
  const mapped = mapLoadResult(load);
  useAppStore.getState().loadProjectBundle(mapped);
  return mapped;
}

export async function createProjectWithFirstDocument(name: string) {
  const ws = await createProject({ name, initialDocumentName: "Untitled.md" });
  await fetchProjects();
  await fetchProjectBundle(ws.id);
  // After fetching the bundle the activeProjectId / activeDocumentId are
  // recomputed by loadProjectBundle; ensure the just-created project is the
  // active one even if a previous project is also present.
  useAppStore.getState().setActiveProject(ws.id);
  useAppStore.getState().setCenterMode("edit");
  return ws;
}
