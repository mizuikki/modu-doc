import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { pickFirstVisibleDocument } from "./activation";
import {
  initialUI,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "./defaults";
import { applyLoadedWorkspaceState } from "./loadState";
import type { AppState, CenterMode, HydrateInput, RightPanelTab, UiState } from "./types";

export {
  initialUI,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "./defaults";

const VALID_THEMES = new Set<UiState["theme"]>(["light", "dark", "system"]);
const VALID_CENTER_MODES = new Set<CenterMode>(["edit", "split", "preview", "history"]);
const VALID_RIGHT_PANEL_TABS = new Set<RightPanelTab>(["fragments", "recipes", "snapshots"]);

function simpleHash(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

type PersistedUiState = Partial<UiState> & {
  splitRatio?: number;
  viewMode?: string;
  continuousMode?: boolean;
  activeMainTab?: string;
  sidebarCollapsed?: boolean;
  assemblyWidth?: number;
};

type PersistedAppStateForMigration = {
  ui?: PersistedUiState;
  activeWorkspaceId?: string | null;
  activeDocumentId?: string | null;
  // Legacy fields that are no longer persisted but may exist in old storage.
  activeRecipeId?: string | null;
  activeFragmentId?: string | null;
  editorDrafts?: unknown;
  compileStatus?: string;
  workspaceStatusMessage?: string | null;
  snapshots?: unknown;
};

export function migratePersistedAppState(persistedState: unknown, version: number) {
  const persisted = (persistedState as PersistedAppStateForMigration | undefined) ?? {};

  if (persisted.ui) {
    const ui = persisted.ui;
    // Strip legacy UI fields that no longer exist in the v4 shape.
    delete ui.splitRatio;
    delete ui.viewMode;
    delete ui.continuousMode;
    delete ui.activeMainTab;
    delete ui.sidebarCollapsed;
    delete ui.assemblyWidth;
    persisted.ui = {
      ...initialUI,
      ...ui,
      theme: VALID_THEMES.has(ui.theme as UiState["theme"])
        ? (ui.theme as UiState["theme"])
        : initialUI.theme,
      centerMode: VALID_CENTER_MODES.has(ui.centerMode as CenterMode)
        ? (ui.centerMode as CenterMode)
        : initialUI.centerMode,
      sidebarWidth:
        typeof ui.sidebarWidth === "number" && Number.isFinite(ui.sidebarWidth)
          ? clamp(ui.sidebarWidth, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX)
          : initialUI.sidebarWidth,
      rightPanelWidth:
        typeof ui.rightPanelWidth === "number" && Number.isFinite(ui.rightPanelWidth)
          ? clamp(ui.rightPanelWidth, RIGHT_PANEL_WIDTH_MIN, RIGHT_PANEL_WIDTH_MAX)
          : initialUI.rightPanelWidth,
      rightPanelTab: VALID_RIGHT_PANEL_TABS.has(ui.rightPanelTab as RightPanelTab)
        ? (ui.rightPanelTab as RightPanelTab)
        : initialUI.rightPanelTab,
      rightPanelCollapsed:
        typeof ui.rightPanelCollapsed === "boolean"
          ? ui.rightPanelCollapsed
          : initialUI.rightPanelCollapsed,
      zenMode: typeof ui.zenMode === "boolean" ? ui.zenMode : initialUI.zenMode,
      cheatsheetOpen:
        typeof ui.cheatsheetOpen === "boolean" ? ui.cheatsheetOpen : initialUI.cheatsheetOpen,
      settingsDialogOpen:
        typeof ui.settingsDialogOpen === "boolean"
          ? ui.settingsDialogOpen
          : initialUI.settingsDialogOpen,
    };
  }

  // v4 migration: drop legacy activeRecipeId/activeFragmentId and other removed
  // persisted fields. activeDocumentId is preserved.
  if (version < 4) {
    delete persisted.activeRecipeId;
    delete persisted.activeFragmentId;
    delete persisted.compileStatus;
    delete persisted.workspaceStatusMessage;
    delete persisted.snapshots;
  }

  return persisted;
}

function isScreenshotStoreMode() {
  if (!("location" in globalThis) || !globalThis.location) {
    return false;
  }
  return new URLSearchParams(globalThis.location.search).has("screenshot");
}

function browserStorage(): Storage | null {
  if (isScreenshotStoreMode()) {
    return null;
  }
  if ("localStorage" in globalThis && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

export const appStoreStorage: StateStorage = {
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
    (set) => ({
      workspaces: [],
      activeWorkspaceId: null,

      documents: [],
      activeDocumentId: null,

      fragments: [],
      recipes: [],
      recipeItems: [],

      snapshotsByDocumentId: {},
      selectedSnapshotId: null,

      documentDrafts: {},
      documentProcessStatus: {},
      documentStatusMessage: {},

      ui: initialUI,

      hydrate: (input: HydrateInput) =>
        set((state) => {
          const nextActiveDocument = pickFirstVisibleDocument(
            input.documents,
            input.activeDocumentId ?? state.activeDocumentId,
          );
          return {
            workspaces: input.workspaces,
            activeWorkspaceId: input.activeWorkspaceId ?? state.activeWorkspaceId,
            documents: input.documents,
            fragments: input.fragments,
            recipes: input.recipes,
            recipeItems: input.recipeItems,
            snapshotsByDocumentId: input.snapshotsByDocumentId,
            activeDocumentId: nextActiveDocument?.id ?? null,
            selectedSnapshotId: nextActiveDocument
              ? (input.snapshotsByDocumentId[nextActiveDocument.id]?.[0]?.id ?? null)
              : null,
            documentDrafts: {},
            documentProcessStatus: {},
            documentStatusMessage: {},
            ui: state.ui,
          };
        }),

      loadWorkspaceBundle: (input) =>
        set((state) => ({
          ...applyLoadedWorkspaceState(state, input),
          documentDrafts: {},
          documentProcessStatus: {},
          documentStatusMessage: {},
        })),

      setWorkspaceList: (workspaces) =>
        set((state) => {
          const currentActive = state.activeWorkspaceId;
          const stillActive =
            currentActive && workspaces.some((w) => w.id === currentActive)
              ? currentActive
              : (workspaces[0]?.id ?? null);
          const activeWorkspaceId = stillActive;
          // When the active workspace is being removed (or the list becomes
          // empty), also clear the document and snapshot selection so the
          // store does not point at orphaned ids.
          const activeDocumentId = activeWorkspaceId ? state.activeDocumentId : null;
          const selectedSnapshotId = activeWorkspaceId ? state.selectedSnapshotId : null;
          return {
            workspaces,
            activeWorkspaceId,
            activeDocumentId,
            selectedSnapshotId,
          };
        }),

      setActiveWorkspace: (workspaceId) =>
        set(() => ({
          activeWorkspaceId: workspaceId,
        })),

      setActiveDocument: (documentId) =>
        set((state) => {
          if (documentId === state.activeDocumentId) {
            return { selectedSnapshotId: state.selectedSnapshotId };
          }
          const snapshots = documentId ? (state.snapshotsByDocumentId[documentId] ?? []) : [];
          return {
            activeDocumentId: documentId,
            selectedSnapshotId: snapshots[0]?.id ?? null,
          };
        }),

      updateDocumentDraft: (documentId, content) =>
        set((state) => ({
          documentDrafts: {
            ...state.documentDrafts,
            [documentId]: content,
          },
          documentProcessStatus: {
            ...state.documentProcessStatus,
            [documentId]: "editing",
          },
        })),

      flushDocumentDraft: (documentId) =>
        set((state) => {
          const draft = state.documentDrafts[documentId];
          if (draft === undefined) {
            return state;
          }
          return {
            documents: state.documents.map((doc) =>
              doc.id === documentId
                ? {
                    ...doc,
                    content: draft,
                    contentHash: simpleHash(draft),
                  }
                : doc,
            ),
            documentProcessStatus: {
              ...state.documentProcessStatus,
              [documentId]: "saving",
            },
          };
        }),

      clearDocumentDraft: (documentId) =>
        set((state) => {
          if (!(documentId in state.documentDrafts)) {
            return state;
          }
          const nextDrafts: Record<string, string> = { ...state.documentDrafts };
          delete nextDrafts[documentId];
          return { documentDrafts: nextDrafts };
        }),

      patchDocument: (documentId, patch) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === documentId ? { ...doc, ...patch } : doc,
          ),
        })),

      setDocumentProcessStatus: (documentId, status) =>
        set((state) => ({
          documentProcessStatus: {
            ...state.documentProcessStatus,
            [documentId]: status,
          },
        })),

      setDocumentStatusMessage: (documentId, message) =>
        set((state) => ({
          documentStatusMessage: {
            ...state.documentStatusMessage,
            [documentId]: message,
          },
        })),

      setSelectedSnapshot: (snapshotId) => set({ selectedSnapshotId: snapshotId }),

      setTheme: (theme) =>
        set((state) => ({
          ui: {
            ...state.ui,
            theme,
          },
        })),

      setCenterMode: (mode: CenterMode) =>
        set((state) => ({
          ui: {
            ...state.ui,
            centerMode: mode,
          },
        })),

      setZenMode: (zenMode) =>
        set((state) => ({
          ui: {
            ...state.ui,
            zenMode,
          },
        })),

      toggleZenMode: () =>
        set((state) => ({
          ui: {
            ...state.ui,
            zenMode: !state.ui.zenMode,
          },
        })),

      setCheatsheetOpen: (open) =>
        set((state) => ({
          ui: {
            ...state.ui,
            cheatsheetOpen: open,
          },
        })),

      toggleCheatsheet: () =>
        set((state) => ({
          ui: {
            ...state.ui,
            cheatsheetOpen: !state.ui.cheatsheetOpen,
          },
        })),

      setSettingsDialogOpen: (open) =>
        set((state) => ({
          ui: {
            ...state.ui,
            settingsDialogOpen: open,
          },
        })),

      setSidebarWidth: (width) =>
        set((state) => ({
          ui: {
            ...state.ui,
            sidebarWidth: clamp(width, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX),
          },
        })),

      setRightPanelWidth: (width) =>
        set((state) => ({
          ui: {
            ...state.ui,
            rightPanelWidth: clamp(width, RIGHT_PANEL_WIDTH_MIN, RIGHT_PANEL_WIDTH_MAX),
          },
        })),

      setRightPanelTab: (tab: RightPanelTab) =>
        set((state) => ({
          ui: {
            ...state.ui,
            rightPanelTab: tab,
          },
        })),

      setRightPanelCollapsed: (collapsed) =>
        set((state) => ({
          ui: {
            ...state.ui,
            rightPanelCollapsed: collapsed,
          },
        })),

      toggleRightPanelCollapsed: () =>
        set((state) => ({
          ui: {
            ...state.ui,
            rightPanelCollapsed: !state.ui.rightPanelCollapsed,
          },
        })),
    }),
    {
      name: "modudoc-app-store",
      version: 5,
      migrate: migratePersistedAppState,
      storage: createJSONStorage(() => appStoreStorage),
      partialize: (state) => ({
        ui: state.ui,
        activeWorkspaceId: state.activeWorkspaceId,
        activeDocumentId: state.activeDocumentId,
      }),
    },
  ),
);
