import type {
  AppState,
  Fragment,
  Recipe,
  RecipeItem,
  SnapshotSummary,
  WorkspaceSummary,
} from "./types";

export function selectActiveWorkspace(state: AppState): WorkspaceSummary | null {
  return state.workspaces.find((entry) => entry.id === state.activeWorkspaceId) ?? null;
}

export function selectActiveFragment(state: AppState): Fragment | null {
  return state.fragments.find((entry) => entry.id === state.activeFragmentId) ?? null;
}

export function selectActiveRecipe(state: AppState): Recipe | null {
  return state.recipes.find((entry) => entry.id === state.activeRecipeId) ?? null;
}

export function selectActiveRecipeItem(state: AppState): RecipeItem | null {
  if (!state.activeRecipeId || !state.activeFragmentId) {
    return null;
  }
  return (
    state.recipeItems.find(
      (entry) =>
        entry.recipeId === state.activeRecipeId && entry.fragmentId === state.activeFragmentId,
    ) ?? null
  );
}

export function selectSelectedSnapshot(state: AppState): SnapshotSummary | null {
  return state.snapshots.find((entry) => entry.id === state.selectedSnapshotId) ?? null;
}
