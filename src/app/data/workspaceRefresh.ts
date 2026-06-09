import { useAppStore } from "@/store/appStore";
import { fetchWorkspaceBundle, fetchWorkspaces } from "./workspaceData";

/**
 * Refresh the workspace list and push it into the store. No-op if there is
 * already a hydrated list.
 */
export async function refreshWorkspaceListToStore(): Promise<void> {
  await fetchWorkspaces();
}

/**
 * Refresh the active workspace bundle (documents, fragments, recipes,
 * recipe items, snapshots) into the store. If no workspace is active, the
 * store is left untouched.
 */
export async function refreshWorkspaceBundleToStore(
  workspaceId: string | null = useAppStore.getState().activeWorkspaceId,
): Promise<void> {
  if (!workspaceId) {
    return;
  }
  await fetchWorkspaceBundle(workspaceId);
}
