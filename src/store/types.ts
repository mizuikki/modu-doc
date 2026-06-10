export type DocumentSaveState = "draft" | "unsaved" | "saved" | "conflict" | "error";

export type DocumentProcessStatus =
  | "idle"
  | "editing"
  | "saving"
  | "writing"
  | "synced"
  | "conflict"
  | "error";

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSummary = {
  id: string;
  projectId: string;
  name: string;
  content: string;
  contentHash: string;
  targetPath: string | null;
  saveState: DocumentSaveState;
  lastWrittenAt: string | null;
  lastWrittenHash: string | null;
  sortOrder: number;
  deletedAt: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Fragment = {
  id: string;
  projectId: string;
  name: string;
  content: string;
  contentHash: string;
  tags: string;
  category: string | null;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Recipe = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  deletedAt: string | null;
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
  documentId: string;
  label: string | null;
  content: string;
  contentHash: string;
  createdAt: string;
};

export type RightPanelTab = "fragments" | "recipes" | "snapshots";
export type CenterMode = "edit" | "split" | "preview" | "history";

export type UiState = {
  theme: "light" | "dark" | "system";
  centerMode: CenterMode;
  sidebarWidth: number;
  rightPanelWidth: number;
  rightPanelTab: RightPanelTab;
  rightPanelCollapsed: boolean;
  zenMode: boolean;
  cheatsheetOpen: boolean;
  settingsDialogOpen: boolean;
};

export type HydrateInput = {
  projects: ProjectSummary[];
  activeProjectId?: string | null;
  documents: DocumentSummary[];
  fragments: Fragment[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  snapshotsByDocumentId: Record<string, SnapshotSummary[]>;
  activeDocumentId?: string | null;
};

export type LoadProjectBundleInput = {
  documents: DocumentSummary[];
  fragments: Fragment[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  snapshotsByDocumentId: Record<string, SnapshotSummary[]>;
};

export type AppState = {
  // Persisted project bundle
  projects: ProjectSummary[];
  activeProjectId: string | null;

  documents: DocumentSummary[];
  activeDocumentId: string | null;

  fragments: Fragment[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];

  snapshotsByDocumentId: Record<string, SnapshotSummary[]>;
  selectedSnapshotId: string | null;

  // Per-document runtime state (NOT persisted)
  documentDrafts: Record<string, string>;
  documentProcessStatus: Record<string, DocumentProcessStatus>;
  documentStatusMessage: Record<string, string | null>;

  ui: UiState;

  // Hydration & bundle
  hydrate: (input: HydrateInput) => void;
  loadProjectBundle: (input: LoadProjectBundleInput) => void;
  setProjectList: (projects: ProjectSummary[]) => void;
  setActiveProject: (projectId: string | null) => void;
  setActiveDocument: (documentId: string | null) => void;

  // Document runtime
  updateDocumentDraft: (documentId: string, content: string) => void;
  flushDocumentDraft: (documentId: string) => void;
  clearDocumentDraft: (documentId: string) => void;
  patchDocument: (documentId: string, patch: Partial<DocumentSummary>) => void;
  setDocumentProcessStatus: (documentId: string, status: DocumentProcessStatus) => void;
  setDocumentStatusMessage: (documentId: string, message: string | null) => void;

  // Snapshots
  setSelectedSnapshot: (snapshotId: string | null) => void;

  // UI
  setTheme: (theme: UiState["theme"]) => void;
  setCenterMode: (mode: CenterMode) => void;
  setZenMode: (zenMode: boolean) => void;
  toggleZenMode: () => void;
  setCheatsheetOpen: (open: boolean) => void;
  toggleCheatsheet: () => void;
  setSettingsDialogOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleRightPanelCollapsed: () => void;
};
