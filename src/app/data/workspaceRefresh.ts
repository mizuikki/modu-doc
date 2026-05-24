import type { AppState } from "@/store/types";
import { fetchWorkspaceBundle, fetchWorkspaceSummaries } from "./workspaceData";

export async function refreshWorkspaceListToStore(args: {
  loadWorkspaces: AppState["hydrate"];
  setWorkspaceList: AppState["setWorkspaceList"];
}): Promise<void> {
  const summaries = await fetchWorkspaceSummaries();
  if (summaries.length === 0) {
    args.loadWorkspaces({
      workspaces: [],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshots: [],
    });
    return;
  }
  args.setWorkspaceList(summaries);
}

export async function refreshWorkspaceBundleToStore(args: {
  workspaceId: string | null;
  setWorkspaceBundle: AppState["setWorkspaceBundle"];
}): Promise<void> {
  if (!args.workspaceId) {
    args.setWorkspaceBundle({ fragments: [], recipes: [], recipeItems: [], snapshots: [] });
    return;
  }
  const bundle = await fetchWorkspaceBundle(args.workspaceId);
  args.setWorkspaceBundle(bundle);
}
