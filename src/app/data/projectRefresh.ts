import { useAppStore } from "@/store/appStore";
import { fetchProjectBundle, fetchProjects } from "./projectData";

/**
 * Refresh the project list and push it into the store. No-op if there is
 * already a hydrated list.
 */
export async function refreshProjectListToStore(): Promise<void> {
  await fetchProjects();
}

/**
 * Refresh the active project bundle (documents, fragments, recipes,
 * recipe items, snapshots) into the store. If no project is active, the
 * store is left untouched.
 */
export async function refreshProjectBundleToStore(
  projectId: string | null = useAppStore.getState().activeProjectId,
): Promise<void> {
  if (!projectId) {
    return;
  }
  await fetchProjectBundle(projectId);
}
