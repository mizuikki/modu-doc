import { tauriInvoke } from "./tauri";

export type RecipeItemWire = {
  id: string;
  recipe_id: string;
  fragment_id: string;
  enabled: boolean;
  sort_order: number;
};

export async function createRecipe(args: {
  workspaceId: string;
  name: string;
  description?: string;
}) {
  return await tauriInvoke<{ id: string }>("create_recipe", {
    workspaceId: args.workspaceId,
    name: args.name,
    description: args.description ?? "",
  });
}

export async function activateRecipe(recipeId: string) {
  await tauriInvoke("activate_recipe", { recipeId });
}

export async function updateRecipeItems(args: { recipeId: string; items: RecipeItemWire[] }) {
  await tauriInvoke("update_recipe_items", { recipeId: args.recipeId, items: args.items });
}
