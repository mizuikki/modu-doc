import type {
  DocumentWire,
  FragmentWire,
  ProjectLoadResult,
  ProjectWire,
  RecipeItemWire,
  RecipeWire,
  SnapshotWire,
} from "@/lib/api/types";
import type {
  DocumentSummary,
  Fragment,
  ProjectSummary,
  Recipe,
  RecipeItem,
  SnapshotSummary,
} from "@/store/types";

export function mapProject(wire: ProjectWire): ProjectSummary {
  return {
    id: wire.id,
    name: wire.name,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

export function mapDocument(wire: DocumentWire): DocumentSummary {
  return {
    id: wire.id,
    projectId: wire.project_id,
    name: wire.name,
    content: wire.content,
    contentHash: wire.content_hash,
    targetPath: wire.target_path,
    saveState: wire.save_state,
    lastWrittenAt: wire.last_written_at,
    lastWrittenHash: wire.last_written_hash,
    sortOrder: wire.sort_order,
    deletedAt: wire.deleted_at,
    description: wire.description,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

export function mapFragment(wire: FragmentWire): Fragment {
  return {
    id: wire.id,
    projectId: wire.project_id,
    name: wire.name,
    content: wire.content,
    contentHash: wire.content_hash,
    // tags wire field is a JSON string; in-memory shape also stores a string.
    tags: wire.tags,
    category: wire.category,
    sortOrder: wire.sort_order,
    deletedAt: wire.deleted_at,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

export function mapRecipe(wire: RecipeWire): Recipe {
  return {
    id: wire.id,
    projectId: wire.project_id,
    name: wire.name,
    description: wire.description,
    deletedAt: wire.deleted_at,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

export function mapRecipeItem(wire: RecipeItemWire): RecipeItem {
  return {
    id: wire.id,
    recipeId: wire.recipe_id,
    fragmentId: wire.fragment_id,
    enabled: wire.enabled,
    sortOrder: wire.sort_order,
  };
}

export function mapSnapshot(wire: SnapshotWire): SnapshotSummary {
  return {
    id: wire.id,
    documentId: wire.document_id,
    label: wire.label,
    content: wire.content,
    contentHash: wire.content_hash,
    createdAt: wire.created_at,
  };
}

export type LoadResultBundle = {
  project: ProjectSummary;
  documents: DocumentSummary[];
  fragments: Fragment[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  snapshotsByDocumentId: Record<string, SnapshotSummary[]>;
};

export function mapLoadResult(wire: ProjectLoadResult): LoadResultBundle {
  const fragments = wire.fragments.map(mapFragment);
  const recipes = wire.recipes.map(mapRecipe);
  const recipeItems = wire.recipe_items.map(mapRecipeItem);
  const documents = wire.documents.map(mapDocument);
  const snapshotsByDocumentId: Record<string, SnapshotSummary[]> = {};
  for (const [docId, list] of Object.entries(wire.snapshots ?? {})) {
    snapshotsByDocumentId[docId] = list.map(mapSnapshot);
  }
  return {
    project: mapProject(wire.project),
    documents,
    fragments,
    recipes,
    recipeItems,
    snapshotsByDocumentId,
  };
}
