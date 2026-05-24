import type { AppState } from "./types";

export function selectActiveRecipeId(args: {
  recipes: AppState["recipes"];
  workspaceId: string;
  preferredRecipeId: string | null;
}): string | null {
  const workspaceRecipes = args.recipes.filter((recipe) => recipe.workspaceId === args.workspaceId);
  if (workspaceRecipes.length === 0) return null;
  if (
    args.preferredRecipeId &&
    workspaceRecipes.some((recipe) => recipe.id === args.preferredRecipeId)
  ) {
    return args.preferredRecipeId;
  }
  return workspaceRecipes.find((recipe) => recipe.isActive)?.id ?? workspaceRecipes[0]?.id ?? null;
}

export function selectFirstActiveFragmentId(args: {
  fragments: AppState["fragments"];
  workspaceId: string;
}): string | null {
  return (
    args.fragments.find(
      (fragment) => fragment.workspaceId === args.workspaceId && fragment.deletedAt === null,
    )?.id ?? null
  );
}

export function selectFirstActiveFragmentIdForRecipe(args: {
  fragments: AppState["fragments"];
  recipeItems: AppState["recipeItems"];
  recipeId: string;
  preferredFragmentId: string | null;
}): string | null {
  if (
    args.preferredFragmentId &&
    args.fragments.some(
      (fragment) => fragment.id === args.preferredFragmentId && fragment.deletedAt === null,
    )
  ) {
    return args.preferredFragmentId;
  }
  const items = args.recipeItems
    .filter((item) => item.recipeId === args.recipeId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of items) {
    const fragment = args.fragments.find((entry) => entry.id === item.fragmentId);
    if (fragment && fragment.deletedAt === null) {
      return fragment.id;
    }
  }
  return null;
}
