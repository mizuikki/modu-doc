import type { AppState } from "../types";

type SetState = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
  replace?: false | undefined,
) => void;

type ReplaceState = (state: AppState | ((state: AppState) => AppState), replace: true) => void;

type StoreSetState = SetState & ReplaceState;

type GetState = () => AppState;

export function createCompileReducers(set: StoreSetState, get: GetState) {
  return {
    compileActiveWorkspace: () => {
      const { activeRecipeId, fragments, recipeItems, activeWorkspaceId, workspaces } = get();
      const workspace = workspaces.find((entry) => entry.id === activeWorkspaceId);
      const recipeId = activeRecipeId;
      if (!workspace || !recipeId) {
        set({ compileStatus: "error" });
        return "";
      }
      const orderedItems = recipeItems
        .filter((item) => item.recipeId === recipeId && item.enabled)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
      const activeFragmentIds = new Set(activeFragments.map((fragment) => fragment.id));
      const output = orderedItems
        .filter((item) => activeFragmentIds.has(item.fragmentId))
        .map(
          (item) =>
            activeFragments.find((fragment) => fragment.id === item.fragmentId)?.content ?? "",
        )
        .join("\n\n");
      set({ compileStatus: "synced" });
      return output;
    },
    resolveConflict: () => set({ compileStatus: "compiling" }),
  } as const;
}
