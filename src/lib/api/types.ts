export type DocumentSaveState = "draft" | "unsaved" | "saved" | "conflict" | "error";

export type ProjectWire = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type DocumentWire = {
  id: string;
  project_id: string;
  name: string;
  content: string;
  content_hash: string;
  target_path: string | null;
  save_state: DocumentSaveState;
  last_written_at: string | null;
  last_written_hash: string | null;
  sort_order: number;
  deleted_at: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FragmentWire = {
  id: string;
  project_id: string;
  name: string;
  content: string;
  content_hash: string;
  tags: string;
  category: string | null;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeWire = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeItemWire = {
  id: string;
  recipe_id: string;
  fragment_id: string;
  enabled: boolean;
  sort_order: number;
};

export type SnapshotWire = {
  id: string;
  document_id: string;
  label: string | null;
  content: string;
  content_hash: string;
  created_at: string;
};

export type ProjectLoadResult = {
  project: ProjectWire;
  documents: DocumentWire[];
  fragments: FragmentWire[];
  recipes: RecipeWire[];
  recipe_items: RecipeItemWire[];
  snapshots: Record<string, SnapshotWire[]>;
};

export type DocumentConflictStatus = {
  document_id: string;
  has_conflict: boolean;
  external_content_hash: string | null;
};

export type SearchResult = {
  kind: "project" | "fragment" | "recipe" | "snapshot" | "document";
  id: string;
  project_id: string | null;
  document_id: string | null;
  title: string;
  subtitle: string;
};
