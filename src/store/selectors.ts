import type { AppState, Fragment, Recipe, SnapshotSummary, WorkspaceSummary } from "./types";

export function selectActiveWorkspace(state: AppState): WorkspaceSummary | null {
  return state.workspaces.find((entry) => entry.id === state.activeWorkspaceId) ?? null;
}

export function selectActiveFragment(state: AppState): Fragment | null {
  return state.fragments.find((entry) => entry.id === state.activeFragmentId) ?? null;
}

export function selectActiveRecipe(state: AppState): Recipe | null {
  return state.recipes.find((entry) => entry.id === state.activeRecipeId) ?? null;
}

export function selectSelectedSnapshot(state: AppState): SnapshotSummary | null {
  return state.snapshots.find((entry) => entry.id === state.selectedSnapshotId) ?? null;
}
