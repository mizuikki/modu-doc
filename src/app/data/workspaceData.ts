import { listWorkspaces, loadWorkspace } from "@/lib/api/workspaces";
import type { AppState } from "@/store/types";
import {
  toFragment,
  toRecipe,
  toRecipeItem,
  toSnapshot,
  toWorkspaceSummary,
} from "../workspaceMappers";

export async function fetchWorkspaceSummaries(): Promise<AppState["workspaces"]> {
  const workspaces = await listWorkspaces();
  return workspaces.map(toWorkspaceSummary);
}

export async function fetchWorkspaceBundle(
  workspaceId: string,
): Promise<Pick<AppState, "fragments" | "recipes" | "recipeItems" | "snapshots">> {
  const bundle = await loadWorkspace(workspaceId);
  return {
    fragments: bundle.fragments.map(toFragment),
    recipes: bundle.recipes.map(toRecipe),
    recipeItems: bundle.recipe_items.map(toRecipeItem),
    snapshots: bundle.snapshots.map(toSnapshot),
  };
}
