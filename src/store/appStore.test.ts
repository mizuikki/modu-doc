import { beforeEach, describe, expect, it } from "vitest";
import { initialUI, migratePersistedAppState, useAppStore } from "./appStore";
import { createDefaultWorkspaceState } from "./defaults";

function resetStore() {
  localStorage.clear();
  useAppStore.persist.clearStorage();
  useAppStore.setState({
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
    ui: {
      theme: "light",
      activeMainTab: "edit",
      sidebarCollapsed: false,
      zenMode: false,
      sidebarWidth: 196,
      assemblyWidth: 500,
      cheatsheetOpen: false,
    },
  });
}

describe("appStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("hydrates default workspace state", () => {
    useAppStore.getState().hydrate(createDefaultWorkspaceState());

    expect(useAppStore.getState().workspaces).toHaveLength(1);
    expect(useAppStore.getState().activeWorkspaceId).toBe("workspace-default");
    expect(useAppStore.getState().activeRecipeId).toBe("recipe-default");
    expect(useAppStore.getState().activeFragmentId).toBe("fragment-default");
    expect(useAppStore.getState().selectedSnapshotId).toBeNull();
  });

  it("updates drafts and flushes content", () => {
    useAppStore.getState().hydrate(createDefaultWorkspaceState());
    useAppStore.getState().updateEditorDraft("fragment-default", "# Updated");
    expect(useAppStore.getState().compileStatus).toBe("editing");

    useAppStore.getState().flushEditorDraft("fragment-default");
    expect(useAppStore.getState().compileStatus).toBe("saving");
    expect(useAppStore.getState().fragments[0]?.content).toBe("# Updated");

    useAppStore.getState().restoreFragmentContent("fragment-default", "# ModuDoc");
    useAppStore.getState().clearEditorDraft("fragment-default");
    expect(useAppStore.getState().fragments[0]?.content).toBe("# ModuDoc");
    expect(useAppStore.getState().editorDrafts["fragment-default"]).toBeUndefined();
  });

  it("compiles enabled fragments in order", () => {
    useAppStore.getState().hydrate(createDefaultWorkspaceState());
    const output = useAppStore.getState().compileActiveWorkspace();
    expect(output).toMatch(/# ModuDoc/);
    expect(useAppStore.getState().compileStatus).toBe("synced");
  });

  it("ignores deleted fragments when compiling", () => {
    useAppStore.getState().hydrate({
      ...createDefaultWorkspaceState(),
      fragments: [
        ...createDefaultWorkspaceState().fragments,
        {
          id: "fragment-deleted",
          workspaceId: "workspace-default",
          name: "Deleted",
          content: "# Deleted",
          contentHash: "",
          sortOrder: 1,
          isArchived: false,
          deletedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      recipeItems: [
        {
          id: "recipe-item-default",
          recipeId: "recipe-default",
          fragmentId: "fragment-default",
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "recipe-item-deleted",
          recipeId: "recipe-default",
          fragmentId: "fragment-deleted",
          enabled: true,
          sortOrder: 1,
        },
      ],
    });
    const output = useAppStore.getState().compileActiveWorkspace();
    expect(output).toMatch(/# ModuDoc/);
    expect(output).not.toMatch(/# Deleted/);
  });

  it("clears workspace-scoped state when no workspace is selected", () => {
    useAppStore.getState().hydrate(createDefaultWorkspaceState());
    useAppStore.getState().setActiveWorkspace(null);
    expect(useAppStore.getState().activeWorkspaceId).toBeNull();
    expect(useAppStore.getState().activeRecipeId).toBeNull();
    expect(useAppStore.getState().activeFragmentId).toBeNull();
    expect(useAppStore.getState().selectedSnapshotId).toBeNull();
  });

  it("keeps the active fragment when reordering the current recipe", () => {
    useAppStore.getState().hydrate(createDefaultWorkspaceState());
    useAppStore.getState().setActiveFragment("fragment-default");
    useAppStore.getState().reorderRecipeItems("recipe-default", ["fragment-default"]);
    expect(useAppStore.getState().activeFragmentId).toBe("fragment-default");
  });

  it("migrates persisted ui state by removing legacy edit mode fields", () => {
    const migrated = migratePersistedAppState(
      {
        ui: {
          ...initialUI,
          sidebarWidth: 200,
          assemblyWidth: 400,
          splitRatio: 0.65,
          viewMode: "read",
          continuousMode: true,
        },
      },
      1,
    );

    expect(migrated.ui).toEqual({
      ...initialUI,
      sidebarWidth: 196,
      assemblyWidth: 500,
    });
  });
});
