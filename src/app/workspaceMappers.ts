import type { WorkspaceLoadResult } from "@/lib/api/types";
import type {
  Fragment,
  Recipe,
  RecipeItem,
  SnapshotSummary,
  WorkspaceSummary,
} from "@/store/types";

export function toWorkspaceSummary(workspace: WorkspaceLoadResult["workspace"]): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    targetPath: workspace.target_path,
    defaultRecipeId: workspace.default_recipe_id,
    status: workspace.status as WorkspaceSummary["status"],
    lastCompiledAt: workspace.last_compiled_at,
    lastCompiledHash: workspace.last_compiled_hash,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
  };
}

export function toFragment(fragment: WorkspaceLoadResult["fragments"][number]): Fragment {
  return {
    id: fragment.id,
    workspaceId: fragment.workspace_id,
    name: fragment.name,
    content: fragment.content,
    contentHash: fragment.content_hash,
    sortOrder: fragment.sort_order,
    isArchived: fragment.is_archived,
    deletedAt: fragment.deleted_at,
    createdAt: fragment.created_at,
    updatedAt: fragment.updated_at,
  };
}

export function toRecipe(recipe: WorkspaceLoadResult["recipes"][number]): Recipe {
  return {
    id: recipe.id,
    workspaceId: recipe.workspace_id,
    name: recipe.name,
    description: recipe.description,
    isActive: recipe.is_active,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
  };
}

export function toRecipeItem(item: WorkspaceLoadResult["recipe_items"][number]): RecipeItem {
  return {
    id: item.id,
    recipeId: item.recipe_id,
    fragmentId: item.fragment_id,
    enabled: item.enabled,
    sortOrder: item.sort_order,
  };
}

export function toSnapshot(snapshot: WorkspaceLoadResult["snapshots"][number]): SnapshotSummary {
  return {
    id: snapshot.id,
    workspaceId: snapshot.workspace_id,
    recipeId: snapshot.recipe_id,
    label: snapshot.label,
    snapshotJson: snapshot.snapshot_json,
    compiledText: snapshot.compiled_text,
    compiledHash: snapshot.compiled_hash,
    createdAt: snapshot.created_at,
  };
}
