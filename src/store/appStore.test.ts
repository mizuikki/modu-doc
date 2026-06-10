import { beforeEach, describe, expect, it } from "vitest";
import { migratePersistedAppState, useAppStore } from "./appStore";
import {
  initialUI,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "./defaults";
import {
  selectActiveDocument,
  selectActiveDocumentDraft,
  selectActiveDocumentProcessStatus,
  selectActiveDocumentSnapshots,
  selectActiveDocumentStatusMessage,
  selectActiveProject,
  selectVisibleDocuments,
  selectVisibleFragments,
} from "./selectors";
import type { DocumentSummary, Fragment, Recipe, RecipeItem, SnapshotSummary } from "./types";

function iso(offsetMs = 0) {
  return new Date(2024, 0, 1, 0, 0, 0, offsetMs).toISOString();
}

function makeProject(id = "ws-1") {
  return {
    id,
    name: "Project 1",
    createdAt: iso(0),
    updatedAt: iso(0),
  };
}

function makeDocument(
  id: string,
  projectId: string,
  overrides: Partial<DocumentSummary> = {},
): DocumentSummary {
  return {
    id,
    projectId,
    name: id,
    content: `# ${id}`,
    contentHash: "",
    targetPath: null,
    saveState: "draft",
    lastWrittenAt: null,
    lastWrittenHash: null,
    sortOrder: 0,
    deletedAt: null,
    description: null,
    createdAt: iso(0),
    updatedAt: iso(0),
    ...overrides,
  };
}

function makeFragment(id: string, projectId: string): Fragment {
  return {
    id,
    projectId,
    name: id,
    content: "",
    contentHash: "",
    tags: "[]",
    category: null,
    sortOrder: 0,
    deletedAt: null,
    createdAt: iso(0),
    updatedAt: iso(0),
  };
}

function makeRecipe(id: string, projectId: string): Recipe {
  return {
    id,
    projectId,
    name: id,
    description: "",
    deletedAt: null,
    createdAt: iso(0),
    updatedAt: iso(0),
  };
}

function makeRecipeItem(id: string, recipeId: string, fragmentId: string): RecipeItem {
  return {
    id,
    recipeId,
    fragmentId,
    enabled: true,
    sortOrder: 0,
  };
}

function makeSnapshot(
  id: string,
  documentId: string,
  label: string | null = null,
): SnapshotSummary {
  return {
    id,
    documentId,
    label,
    content: `# ${documentId} snapshot ${id}`,
    contentHash: "",
    createdAt: iso(0),
  };
}

// Each test starts with a fully-populated in-memory state. The persist
// middleware in zustand v5 can leave the in-memory state partialized after a
// setItem call, so we always re-assert the full state via setState, including
// the UI slice, and write a known-good initial snapshot to localStorage so
// that any subsequent rehydration from storage restores the full UI.
function resetStore() {
  const initialPersisted = {
    state: {
      ui: { ...initialUI },
      activeProjectId: null,
      activeDocumentId: null,
    },
    version: 5,
  };
  localStorage.setItem("modudoc-app-store", JSON.stringify(initialPersisted));
  useAppStore.setState({
    projects: [],
    activeProjectId: null,
    activeDocumentId: null,
    documents: [],
    fragments: [],
    recipes: [],
    recipeItems: [],
    snapshotsByDocumentId: {},
    selectedSnapshotId: null,
    documentDrafts: {},
    documentProcessStatus: {},
    documentStatusMessage: {},
    ui: { ...initialUI },
  });
}

describe("appStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("hydrate_sets_active_document_to_first_visible", () => {
    const docA = makeDocument("doc-a", "ws-1", { sortOrder: 1 });
    const docB = makeDocument("doc-b", "ws-1", {
      sortOrder: 0,
      deletedAt: iso(1),
    });

    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [docA, docB],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    expect(useAppStore.getState().activeDocumentId).toBe("doc-a");
  });

  it("loadProjectBundle_replaces_documents_and_picks_active", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    useAppStore.getState().loadProjectBundle({
      documents: [
        makeDocument("doc-b", "ws-1", { sortOrder: 0 }),
        makeDocument("doc-c", "ws-1", { sortOrder: 1 }),
      ],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    const state = useAppStore.getState();
    expect(state.documents.map((d) => d.id)).toEqual(["doc-b", "doc-c"]);
    expect(state.activeDocumentId).toBe("doc-b");
  });

  it("updateDocumentDraft_writes_draft_and_marks_editing", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    useAppStore.getState().updateDocumentDraft("doc-a", "draft body");

    const state = useAppStore.getState();
    expect(state.documentDrafts["doc-a"]).toBe("draft body");
    expect(state.documentProcessStatus["doc-a"]).toBe("editing");
  });

  it("flushDocumentDraft_persists_draft_into_document_content", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    useAppStore.getState().updateDocumentDraft("doc-a", "flushed body");
    useAppStore.getState().flushDocumentDraft("doc-a");

    const state = useAppStore.getState();
    const doc = state.documents.find((d) => d.id === "doc-a");
    expect(doc?.content).toBe("flushed body");
    expect(doc?.contentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(state.documentProcessStatus["doc-a"]).toBe("saving");
  });

  it("patchDocument_merges_partial_fields", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    useAppStore.getState().patchDocument("doc-a", { name: "Renamed", targetPath: "/tmp/a.md" });

    const doc = useAppStore.getState().documents.find((d) => d.id === "doc-a");
    expect(doc?.name).toBe("Renamed");
    expect(doc?.targetPath).toBe("/tmp/a.md");
  });

  it("selectors_select_active_document_returns_null_when_no_active", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });
    useAppStore.getState().setActiveDocument(null);

    expect(selectActiveDocument(useAppStore.getState())).toBeNull();
  });

  it("selectors_select_active_document_draft_returns_draft_when_present", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1", { content: "saved" })],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });
    useAppStore.getState().updateDocumentDraft("doc-a", "draft body");

    expect(selectActiveDocumentDraft(useAppStore.getState())).toBe("draft body");
  });

  it("selectors_select_active_document_snapshots_returns_per_document_list", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1"), makeDocument("doc-b", "ws-1", { sortOrder: 1 })],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {
        "doc-a": [makeSnapshot("snap-a1", "doc-a"), makeSnapshot("snap-a2", "doc-a")],
        "doc-b": [makeSnapshot("snap-b1", "doc-b")],
      },
    });
    useAppStore.getState().setActiveDocument("doc-a");

    const snapshots = selectActiveDocumentSnapshots(useAppStore.getState());
    expect(snapshots.map((s) => s.id)).toEqual(["snap-a1", "snap-a2"]);
  });

  it("setSidebarWidth_clamps_to_range", () => {
    useAppStore.getState().setSidebarWidth(50);
    expect(useAppStore.getState().ui.sidebarWidth).toBe(SIDEBAR_WIDTH_MIN);

    useAppStore.getState().setSidebarWidth(9999);
    expect(useAppStore.getState().ui.sidebarWidth).toBe(SIDEBAR_WIDTH_MAX);

    useAppStore.getState().setSidebarWidth(280);
    expect(useAppStore.getState().ui.sidebarWidth).toBe(280);
  });

  it("setRightPanelCollapsed_toggles", () => {
    const start = useAppStore.getState().ui.rightPanelCollapsed;
    useAppStore.getState().toggleRightPanelCollapsed();
    expect(useAppStore.getState().ui.rightPanelCollapsed).toBe(!start);
    useAppStore.getState().toggleRightPanelCollapsed();
    expect(useAppStore.getState().ui.rightPanelCollapsed).toBe(start);
  });

  it("migratePersistedAppState_strips_legacy_fields", () => {
    const migrated = migratePersistedAppState(
      {
        ui: {
          theme: "dark",
          centerMode: "split",
          sidebarWidth: 220,
          rightPanelWidth: 320,
          rightPanelTab: "fragments",
          rightPanelCollapsed: true,
          zenMode: false,
          cheatsheetOpen: false,
          settingsDialogOpen: false,
          splitRatio: 0.5,
          viewMode: "split",
          continuousMode: true,
          activeMainTab: "edit",
          sidebarCollapsed: true,
          assemblyWidth: 480,
        } as Record<string, unknown>,
        activeRecipeId: "recipe-1",
        activeFragmentId: "fragment-1",
        compileStatus: "synced",
        projectStatusMessage: "ok",
      },
      3,
    );

    const ui = migrated.ui as Record<string, unknown>;
    expect(ui.splitRatio).toBeUndefined();
    expect(ui.viewMode).toBeUndefined();
    expect(ui.continuousMode).toBeUndefined();
    expect(ui.activeMainTab).toBeUndefined();
    expect(ui.sidebarCollapsed).toBeUndefined();
    expect(ui.assemblyWidth).toBeUndefined();
    expect(ui.theme).toBe("dark");
    expect(ui.centerMode).toBe("split");
    expect(migrated.activeRecipeId).toBeUndefined();
    expect(migrated.activeFragmentId).toBeUndefined();
  });

  it("migratePersistedAppState_restores_missing_ui_widths", () => {
    const migrated = migratePersistedAppState(
      {
        ui: {
          theme: "light",
          centerMode: "edit",
          rightPanelTab: "recipes",
          rightPanelCollapsed: false,
          zenMode: true,
        } as Record<string, unknown>,
      },
      4,
    );

    expect(migrated.ui).toMatchObject({
      sidebarWidth: initialUI.sidebarWidth,
      rightPanelWidth: initialUI.rightPanelWidth,
      rightPanelTab: "recipes",
      rightPanelCollapsed: false,
      zenMode: true,
    });
  });

  it("selectors_helpers_cover_project_and_fragments", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      activeProjectId: "ws-1",
      documents: [
        makeDocument("doc-a", "ws-1", { sortOrder: 0 }),
        makeDocument("doc-b", "ws-1", { sortOrder: 1, deletedAt: iso(1) }),
      ],
      fragments: [makeFragment("frag-a", "ws-1")],
      recipes: [makeRecipe("recipe-a", "ws-1")],
      recipeItems: [makeRecipeItem("ri-1", "recipe-a", "frag-a")],
      snapshotsByDocumentId: {},
    });

    const state = useAppStore.getState();
    expect(selectActiveProject(state)?.id).toBe("ws-1");
    expect(selectVisibleDocuments(state).map((d) => d.id)).toEqual(["doc-a"]);
    expect(selectVisibleFragments(state).map((f) => f.id)).toEqual(["frag-a"]);
  });

  it("per_document_process_status_and_message_selectors", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    useAppStore.getState().setDocumentProcessStatus("doc-a", "saving");
    useAppStore.getState().setDocumentStatusMessage("doc-a", "saving...");

    const state = useAppStore.getState();
    expect(selectActiveDocumentProcessStatus(state)).toBe("saving");
    expect(selectActiveDocumentStatusMessage(state)).toBe("saving...");
  });

  it("setActiveDocument_resets_selected_snapshot_to_first", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1"), makeDocument("doc-b", "ws-1", { sortOrder: 1 })],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {
        "doc-a": [makeSnapshot("snap-a1", "doc-a"), makeSnapshot("snap-a2", "doc-a")],
        "doc-b": [makeSnapshot("snap-b1", "doc-b")],
      },
    });
    useAppStore.getState().setActiveDocument("doc-b");
    expect(useAppStore.getState().selectedSnapshotId).toBe("snap-b1");
  });

  it("setProjectList_drops_active_document_when_no_project_remains", () => {
    useAppStore.getState().hydrate({
      projects: [makeProject()],
      documents: [makeDocument("doc-a", "ws-1")],
      fragments: [],
      recipes: [],
      recipeItems: [],
      snapshotsByDocumentId: {},
    });

    useAppStore.getState().setProjectList([]);

    const state = useAppStore.getState();
    expect(state.activeProjectId).toBeNull();
    expect(state.activeDocumentId).toBeNull();
  });

  it("right_panel_width_clamps_to_range", () => {
    useAppStore.getState().setRightPanelWidth(10);
    expect(useAppStore.getState().ui.rightPanelWidth).toBe(RIGHT_PANEL_WIDTH_MIN);
    useAppStore.getState().setRightPanelWidth(9999);
    expect(useAppStore.getState().ui.rightPanelWidth).toBe(RIGHT_PANEL_WIDTH_MAX);
  });
});
