export type WorkspaceStatus = "ready" | "dirty" | "conflicted" | "error" | "missing_target";
export type CompileStatus =
  | "idle"
  | "editing"
  | "saving"
  | "compiling"
  | "synced"
  | "error"
  | "conflicted";

export type WorkspaceSummary = {
  id: string;
  name: string;
  targetPath: string | null;
  defaultRecipeId: string | null;
  status: WorkspaceStatus;
  lastCompiledAt: string | null;
  lastCompiledHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Fragment = {
  id: string;
  workspaceId: string;
  name: string;
  content: string;
  contentHash: string;
  sortOrder: number;
  isArchived: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Recipe = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeItem = {
  id: string;
  recipeId: string;
  fragmentId: string;
  enabled: boolean;
  sortOrder: number;
};

export type SnapshotSummary = {
  id: string;
  workspaceId: string;
  recipeId: string;
  label: string;
  snapshotJson: string;
  compiledText: string;
  compiledHash: string;
  createdAt: string;
};

export type AppState = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeRecipeId: string | null;
  activeFragmentId: string | null;
  selectedSnapshotId: string | null;
  fragments: Fragment[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  snapshots: SnapshotSummary[];
  editorDrafts: Record<string, string>;
  compileStatus: CompileStatus;
  workspaceStatusMessage: string | null;
  ui: {
    theme: "light" | "dark" | "system";
    activeMainTab: "edit" | "preview" | "history";
    sidebarCollapsed: boolean;
    splitRatio: number;
  };
  hydrate: (
    initial: Pick<AppState, "workspaces" | "fragments" | "recipes" | "recipeItems" | "snapshots">,
  ) => void;
  loadWorkspaces: (
    initial: Pick<AppState, "workspaces" | "fragments" | "recipes" | "recipeItems" | "snapshots">,
  ) => void;
  setWorkspaceList: (workspaces: WorkspaceSummary[]) => void;
  setWorkspaceBundle: (
    bundle: Pick<AppState, "fragments" | "recipes" | "recipeItems" | "snapshots">,
  ) => void;
  updateWorkspaceSummary: (
    workspaceId: string,
    patch: Partial<Pick<WorkspaceSummary, "status" | "lastCompiledAt" | "lastCompiledHash">>,
  ) => void;
  setActiveWorkspace: (workspaceId: string | null) => void;
  setActiveRecipe: (recipeId: string | null) => void;
  setActiveFragment: (fragmentId: string | null) => void;
  setActiveMainTab: (tab: "edit" | "preview" | "history") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setSplitRatio: (ratio: number) => void;
  setCompileStatus: (status: CompileStatus) => void;
  updateEditorDraft: (fragmentId: string, content: string) => void;
  flushEditorDraft: (fragmentId: string) => void;
  clearEditorDraft: (fragmentId: string) => void;
  restoreFragmentContent: (fragmentId: string, content: string) => void;
  reorderRecipeItems: (recipeId: string, orderedFragmentIds: string[]) => void;
  toggleRecipeItem: (recipeId: string, fragmentId: string, enabled: boolean) => void;
  compileActiveWorkspace: () => string;
  resolveConflict: () => void;
  createSnapshot: (label?: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  setSelectedSnapshot: (snapshotId: string | null) => void;
  setWorkspaceStatusMessage: (message: string | null) => void;
};
