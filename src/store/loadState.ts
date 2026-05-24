import type { AppState } from "./types";

type LoadPayload = Pick<
  AppState,
  "workspaces" | "fragments" | "recipes" | "recipeItems" | "snapshots"
>;

export function applyLoadedWorkspaceState(
  current: AppState,
  initial: LoadPayload,
): Pick<
  AppState,
  | "workspaces"
  | "fragments"
  | "recipes"
  | "recipeItems"
  | "snapshots"
  | "activeWorkspaceId"
  | "activeRecipeId"
  | "activeFragmentId"
  | "selectedSnapshotId"
> {
  const activeWorkspaceId =
    current.activeWorkspaceId &&
    initial.workspaces.some((workspace) => workspace.id === current.activeWorkspaceId)
      ? current.activeWorkspaceId
      : (initial.workspaces[0]?.id ?? null);

  const activeRecipeId =
    current.activeRecipeId && initial.recipes.some((recipe) => recipe.id === current.activeRecipeId)
      ? current.activeRecipeId
      : (initial.recipes.find((recipe) => recipe.isActive)?.id ?? initial.recipes[0]?.id ?? null);

  const activeFragmentId =
    current.activeFragmentId &&
    initial.fragments.some(
      (fragment) => fragment.id === current.activeFragmentId && fragment.deletedAt === null,
    )
      ? current.activeFragmentId
      : (initial.fragments.find((fragment) => fragment.deletedAt === null)?.id ?? null);

  const selectedSnapshotId =
    current.selectedSnapshotId &&
    initial.snapshots.some((snapshot) => snapshot.id === current.selectedSnapshotId)
      ? current.selectedSnapshotId
      : (initial.snapshots[0]?.id ?? null);

  return {
    workspaces: initial.workspaces,
    fragments: initial.fragments,
    recipes: initial.recipes,
    recipeItems: initial.recipeItems,
    snapshots: initial.snapshots,
    activeWorkspaceId,
    activeRecipeId,
    activeFragmentId,
    selectedSnapshotId,
  };
}
