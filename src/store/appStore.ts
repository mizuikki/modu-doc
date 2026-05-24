import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { debugLog } from "@/lib/debug";
import {
  selectActiveRecipeId,
  selectFirstActiveFragmentId,
  selectFirstActiveFragmentIdForRecipe,
} from "./activation";
import { applyLoadedWorkspaceState } from "./loadState";
import { createCompileReducers } from "./reducers/compile";
import { createSnapshotReducers } from "./reducers/snapshots";
import type { AppState } from "./types";

const initialUI = {
  theme: "light" as const,
  activeMainTab: "edit" as const,
  sidebarCollapsed: false,
  splitRatio: 0.5,
};

function browserStorage() {
  if ("localStorage" in globalThis && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

const appStoreStorage: StateStorage = {
  getItem: (key) => browserStorage()?.getItem(key) ?? null,
  setItem: (key, value) => {
    browserStorage()?.setItem(key, value);
  },
  removeItem: (key) => {
    browserStorage()?.removeItem(key);
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      activeRecipeId: null,
      activeFragmentId: null,
      selectedSnapshotId: null,
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshots: [],
      editorDrafts: {},
      compileStatus: "idle",
      workspaceStatusMessage: null,
      ui: initialUI,
      hydrate: (initial) =>
        set((state) => ({
          ...state,
          ...applyLoadedWorkspaceState(state, initial),
          editorDrafts: {},
          compileStatus: "idle",
          workspaceStatusMessage: null,
          ui: state.ui,
        })),
      loadWorkspaces: (initial) =>
        set((state) => ({
          ...state,
          ...applyLoadedWorkspaceState(state, initial),
          ui: state.ui,
        })),
      setWorkspaceList: (workspaces) =>
        set((state) => ({
          workspaces,
          activeWorkspaceId:
            state.activeWorkspaceId &&
            workspaces.some((workspace) => workspace.id === state.activeWorkspaceId)
              ? state.activeWorkspaceId
              : (workspaces[0]?.id ?? null),
        })),
      setWorkspaceBundle: (bundle) =>
        set((state) => ({
          ...bundle,
          activeRecipeId:
            state.activeRecipeId &&
            bundle.recipes.some((recipe) => recipe.id === state.activeRecipeId)
              ? state.activeRecipeId
              : (bundle.recipes.find((recipe) => recipe.isActive)?.id ??
                bundle.recipes[0]?.id ??
                null),
          activeFragmentId:
            state.activeFragmentId &&
            bundle.fragments.some(
              (fragment) => fragment.id === state.activeFragmentId && fragment.deletedAt === null,
            )
              ? state.activeFragmentId
              : (bundle.fragments.find((fragment) => fragment.deletedAt === null)?.id ?? null),
          selectedSnapshotId:
            state.selectedSnapshotId &&
            bundle.snapshots.some((snapshot) => snapshot.id === state.selectedSnapshotId)
              ? state.selectedSnapshotId
              : (bundle.snapshots[0]?.id ?? null),
        })),
      updateWorkspaceSummary: (workspaceId, patch) =>
        set((state) => ({
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === workspaceId
              ? {
                  ...workspace,
                  ...patch,
                }
              : workspace,
          ),
        })),
      setActiveWorkspace: (workspaceId) =>
        set((state) => {
          debugLog("workspace:set_active", { workspaceId: workspaceId ?? null });
          if (!workspaceId) {
            return {
              activeWorkspaceId: null,
              activeRecipeId: null,
              activeFragmentId: null,
              selectedSnapshotId: null,
            };
          }
          const nextRecipeId = selectActiveRecipeId({
            recipes: state.recipes,
            workspaceId,
            preferredRecipeId: state.activeRecipeId,
          });
          const nextFragmentId = selectFirstActiveFragmentId({
            fragments: state.fragments,
            workspaceId,
          });
          return {
            activeWorkspaceId: workspaceId,
            activeRecipeId: nextRecipeId,
            activeFragmentId: nextFragmentId,
            selectedSnapshotId: state.snapshots[0]?.id ?? null,
          };
        }),
      setActiveRecipe: (recipeId) =>
        set((state) => {
          debugLog("recipe:set_active", { recipeId: recipeId ?? null });
          const recipe = state.recipes.find((entry) => entry.id === recipeId) ?? null;
          const firstActiveFragment = recipe
            ? (selectFirstActiveFragmentIdForRecipe({
                fragments: state.fragments,
                recipeItems: state.recipeItems,
                recipeId: recipe.id,
                preferredFragmentId: state.activeFragmentId,
              }) ?? state.activeFragmentId)
            : state.activeFragmentId;
          return {
            activeRecipeId: recipeId,
            activeWorkspaceId: recipe?.workspaceId ?? state.activeWorkspaceId,
            activeFragmentId: firstActiveFragment,
          };
        }),
      setActiveFragment: (fragmentId) => set(() => ({ activeFragmentId: fragmentId })),
      setActiveMainTab: (tab) =>
        set((state) => ({
          ui: {
            ...state.ui,
            activeMainTab: tab,
          },
        })),
      setTheme: (theme) =>
        set((state) => ({
          ui: {
            ...state.ui,
            theme,
          },
        })),
      setSplitRatio: (ratio) =>
        set((state) => ({
          ui: {
            ...state.ui,
            splitRatio: Math.min(0.8, Math.max(0.2, ratio)),
          },
        })),
      setCompileStatus: (compileStatus) =>
        set({
          compileStatus,
        }),
      updateEditorDraft: (fragmentId, content) =>
        set((state) => ({
          compileStatus: "editing",
          editorDrafts: {
            ...state.editorDrafts,
            [fragmentId]: content,
          },
        })),
      flushEditorDraft: (fragmentId) =>
        set((state) => {
          const draft = state.editorDrafts[fragmentId];
          if (draft === undefined) {
            return state;
          }
          return {
            fragments: state.fragments.map((fragment) =>
              fragment.id === fragmentId
                ? {
                    ...fragment,
                    content: draft,
                  }
                : fragment,
            ),
            compileStatus: "saving",
          };
        }),
      clearEditorDraft: (fragmentId) =>
        set((state) => {
          if (!(fragmentId in state.editorDrafts)) {
            return state;
          }
          const { [fragmentId]: _removed, ...editorDrafts } = state.editorDrafts;
          return {
            editorDrafts,
          };
        }),
      restoreFragmentContent: (fragmentId, content) =>
        set((state) => ({
          fragments: state.fragments.map((fragment) =>
            fragment.id === fragmentId
              ? {
                  ...fragment,
                  content,
                }
              : fragment,
          ),
        })),
      reorderRecipeItems: (recipeId, orderedFragmentIds) =>
        set((state) => {
          const targetItems = state.recipeItems.filter((item) => item.recipeId === recipeId);
          const rewritten = state.recipeItems.map((item) => {
            if (item.recipeId !== recipeId) return item;
            const sortOrder = orderedFragmentIds.indexOf(item.fragmentId);
            return {
              ...item,
              sortOrder: sortOrder < 0 ? item.sortOrder : sortOrder,
            };
          });
          const nextActiveFragment =
            (state.activeFragmentId &&
            targetItems.some(
              (item) =>
                item.fragmentId === state.activeFragmentId &&
                orderedFragmentIds.includes(item.fragmentId),
            )
              ? state.activeFragmentId
              : orderedFragmentIds.find((fragmentId) =>
                  targetItems.some((item) => item.fragmentId === fragmentId),
                )) ?? state.activeFragmentId;
          return {
            recipeItems: rewritten,
            compileStatus: "compiling",
            activeRecipeId: recipeId,
            activeFragmentId: nextActiveFragment,
          };
        }),
      toggleRecipeItem: (recipeId, fragmentId, enabled) =>
        set((state) => ({
          recipeItems: state.recipeItems.map((item) =>
            item.recipeId === recipeId && item.fragmentId === fragmentId
              ? { ...item, enabled }
              : item,
          ),
          compileStatus: "compiling",
        })),
      ...createCompileReducers(set, get),
      ...createSnapshotReducers(set),
      setSelectedSnapshot: (snapshotId) => set({ selectedSnapshotId: snapshotId }),
      setWorkspaceStatusMessage: (message) => set({ workspaceStatusMessage: message }),
    }),
    {
      name: "modudoc-app-store",
      storage: createJSONStorage(() => appStoreStorage),
      partialize: (state) => ({
        ui: state.ui,
      }),
    },
  ),
);
