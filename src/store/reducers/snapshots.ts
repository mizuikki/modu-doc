import type { AppState } from "../types";

type SetState = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
  replace?: false | undefined,
) => void;

type ReplaceState = (state: AppState | ((state: AppState) => AppState), replace: true) => void;

type StoreSetState = SetState & ReplaceState;

export function createSnapshotReducers(set: StoreSetState) {
  return {
    createSnapshot: (label?: string) =>
      set((state) => ({
        snapshots: [
          ...state.snapshots,
          {
            id: `snapshot-${state.snapshots.length + 1}`,
            workspaceId: state.activeWorkspaceId ?? "",
            recipeId: state.activeRecipeId ?? "",
            label: label ?? "",
            snapshotJson: "{}",
            compiledText: "",
            compiledHash: "",
            createdAt: new Date().toISOString(),
          },
        ],
      })),
    restoreSnapshot: (_snapshotId: string) => set({ compileStatus: "compiling" }),
  } as const;
}
