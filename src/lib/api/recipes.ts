import { tauriInvoke } from "./tauri";
import type { DocumentWire, RecipeItemWire, RecipeWire } from "./types";

export async function createRecipe(args: {
  projectId: string;
  name: string;
  description?: string | null;
}) {
  return await tauriInvoke<RecipeWire>("create_recipe", {
    projectId: args.projectId,
    name: args.name,
    description: args.description ?? null,
  });
}

export async function updateRecipeItems(args: { recipeId: string; items: RecipeItemWire[] }) {
  await tauriInvoke("update_recipe_items", { recipeId: args.recipeId, items: args.items });
}

export async function generateDocumentFromRecipe(args: {
  recipeId: string;
  documentName?: string | null;
}) {
  return await tauriInvoke<DocumentWire>("generate_document_from_recipe", {
    recipeId: args.recipeId,
    documentName: args.documentName ?? null,
  });
}

export async function insertRecipeIntoDocument(args: {
  recipeId: string;
  documentId: string;
  cursorOffset: number;
}) {
  return await tauriInvoke<DocumentWire>("insert_recipe_into_document", args);
}

export async function replaceDocumentWithRecipe(args: { recipeId: string; documentId: string }) {
  return await tauriInvoke<DocumentWire>("replace_document_with_recipe", args);
}
