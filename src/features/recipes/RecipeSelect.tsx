import { useTranslation } from "react-i18next";
import { activateRecipe } from "@/lib/api/recipes";
import { useAppStore } from "@/store/appStore";

export function RecipeSelect() {
  const { t } = useTranslation();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const recipes = useAppStore((state) => state.recipes);
  const setActiveRecipe = useAppStore((state) => state.setActiveRecipe);

  const workspaceRecipes = recipes.filter((recipe) => recipe.workspaceId === activeWorkspaceId);

  return (
    <select
      data-testid="recipe-select"
      value={activeRecipeId ?? ""}
      onChange={(event) => {
        const recipeId = event.target.value || null;
        setActiveRecipe(recipeId);
        if (recipeId) {
          void activateRecipe(recipeId);
        }
      }}
      style={{ padding: 8, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
    >
      <option value="">{t("no_active_recipe")}</option>
      {workspaceRecipes.map((recipe) => (
        <option key={recipe.id} value={recipe.id}>
          {recipe.name}
        </option>
      ))}
    </select>
  );
}
