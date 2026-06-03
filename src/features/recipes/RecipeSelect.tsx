import * as Select from "@radix-ui/react-select";
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
    <Select.Root
      value={activeRecipeId ?? ""}
      onValueChange={(value) => {
        const recipeId = value || null;
        setActiveRecipe(recipeId);
        if (recipeId) {
          void activateRecipe(recipeId);
        }
      }}
    >
      <Select.Trigger
        data-testid="recipe-select"
        aria-label={t("assembly")}
        title={
          activeRecipeId
            ? (workspaceRecipes.find((recipe) => recipe.id === activeRecipeId)?.name ?? "")
            : ""
        }
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "7px 9px",
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          minWidth: 104,
          maxWidth: "100%",
          flex: "1 1 112px",
        }}
      >
        <Select.Value
          placeholder={t("no_active_recipe")}
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
            padding: "2px 0",
          }}
        />
        <Select.Icon style={{ color: "hsl(var(--muted-foreground))" }}>▾</Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          style={{
            zIndex: 50,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
            overflow: "hidden",
          }}
        >
          <Select.Viewport
            style={{
              padding: 6,
              maxHeight: 320,
              width: "var(--radix-select-trigger-width)",
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                fontSize: 12,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {t("assembly")}
            </div>
            {workspaceRecipes.length === 0 ? (
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {t("no_active_recipe")}
              </div>
            ) : (
              workspaceRecipes.map((recipe) => (
                <Select.Item
                  key={recipe.id}
                  value={recipe.id}
                  data-testid={`recipe-select-item-${recipe.id}`}
                  title={recipe.name}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <Select.ItemText>{recipe.name}</Select.ItemText>
                </Select.Item>
              ))
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
