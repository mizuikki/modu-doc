import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { RecipeSelect } from "@/features/recipes/RecipeSelect";
import { SortableFragmentCard } from "@/features/recipes/SortableFragmentCard";
import { activateRecipe, createRecipe, updateRecipeItems } from "@/lib/api/recipes";
import { normalizeAppError } from "@/lib/appError";
import { scheduleWorkspaceSync } from "@/lib/syncScheduler";
import { applyWorkspaceWriteError } from "@/lib/workspaceWrite";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

type RecipeItemRecord = {
  id: string;
  recipeId: string;
  fragmentId: string;
  enabled: boolean;
  sortOrder: number;
};

function serializeRecipeItem(item: RecipeItemRecord) {
  return {
    id: item.id,
    recipe_id: item.recipeId,
    fragment_id: item.fragmentId,
    enabled: item.enabled,
    sort_order: item.sortOrder,
  };
}

export function AssemblyBoard() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const fragments = useAppStore((state) => state.fragments);
  const recipes = useAppStore((state) => state.recipes);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const setActiveRecipe = useAppStore((state) => state.setActiveRecipe);
  const reorderRecipeItems = useAppStore((state) => state.reorderRecipeItems);
  const toggleRecipeItem = useAppStore((state) => state.toggleRecipeItem);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const workspaceRecipes = recipes.filter((recipe) => recipe.workspaceId === activeWorkspaceId);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const currentRecipeId =
    activeRecipeId && workspaceRecipes.some((recipe) => recipe.id === activeRecipeId)
      ? activeRecipeId
      : (workspaceRecipes[0]?.id ?? null);

  useEffect(() => {
    if (!currentRecipeId || currentRecipeId === activeRecipeId) {
      return;
    }
    setActiveRecipe(currentRecipeId);
  }, [activeRecipeId, currentRecipeId, setActiveRecipe]);

  const currentRecipeItems = useMemo<RecipeItemRecord[]>(
    () =>
      recipeItems
        .filter((item) => item.recipeId === currentRecipeId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [currentRecipeId, recipeItems],
  );

  const currentRecipeViews = useMemo(
    () =>
      currentRecipeItems.map((item) => ({
        ...item,
        fragment:
          fragments.find((entry) => entry.id === item.fragmentId && entry.deletedAt === null) ??
          null,
      })),
    [currentRecipeItems, fragments],
  );

  const activeDragItem =
    currentRecipeViews.find((item) => item.fragmentId === activeDragId) ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!currentRecipeId) {
    return (
      <div style={{ padding: 16 }}>
        <h3>{t("assembly")}</h3>
        <p style={{ color: "hsl(var(--muted-foreground))" }}>{t("no_active_recipe")}</p>
      </div>
    );
  }

  const activeRecipe = workspaceRecipes.find((recipe) => recipe.id === currentRecipeId) ?? null;

  const persistRecipeItems = async (nextItems: RecipeItemRecord[]) => {
    try {
      await updateRecipeItems({
        recipeId: currentRecipeId,
        items: nextItems.map(serializeRecipeItem),
      });
      if (activeWorkspace?.targetPath) {
        scheduleWorkspaceSync({
          workspaceId: activeWorkspace.id,
          setWorkspaceStatusMessage,
          setCompileStatus,
        });
      }
    } catch (error) {
      const message = applyWorkspaceWriteError(setWorkspaceStatusMessage, setCompileStatus, error);
      toast.error(message, t("action_failed"));
    }
  };

  const cloneRecipe = async () => {
    if (!activeWorkspaceId || !currentRecipeId) return;
    const result = await dialog.prompt({
      title: t("recipe_name_prompt"),
      defaultValue: `${activeRecipe?.name ?? t("no_active_recipe")} ${t("recipe_copy_suffix")}`,
    });
    const nextName = result.ok ? result.value.trim() : "";
    if (!nextName) return;
    try {
      const recipe = await createRecipe({
        workspaceId: activeWorkspaceId,
        name: nextName,
        description: "",
      });
      await updateRecipeItems({
        recipeId: recipe.id,
        items: currentRecipeItems.map((item, index) =>
          serializeRecipeItem({
            ...item,
            id: crypto.randomUUID(),
            recipeId: recipe.id,
            sortOrder: index,
          }),
        ),
      });
      setActiveRecipe(recipe.id);
      await activateRecipe(recipe.id);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const orderedIds = currentRecipeItems.map((item) => item.fragmentId);
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const next = orderedIds.slice();
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    reorderRecipeItems(currentRecipeId, next);
    void persistRecipeItems(
      currentRecipeItems.map((item) => {
        const sortOrder = next.indexOf(item.fragmentId);
        return {
          ...item,
          sortOrder,
        };
      }),
    );
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>{t("assembly")}</h3>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {activeRecipe?.name ?? t("no_active_recipe")}
            </div>
          </div>
          <RecipeSelect />
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          {t("compile")}: {currentRecipeItems.filter((item) => item.enabled).length} /{" "}
          {currentRecipeItems.length}
        </div>
      </div>
      <button
        type="button"
        onClick={cloneRecipe}
        disabled={!currentRecipeItems.length}
        data-testid="recipe-save-as-new"
      >
        {t("save_as_new_recipe")}
      </button>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={currentRecipeViews.map((item) => item.fragmentId)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: "grid", gap: 12 }} data-testid="assembly-items">
            {currentRecipeViews.map((item) => (
              <SortableFragmentCard
                key={item.id}
                id={item.fragmentId}
                name={item.fragment?.name ?? t("unknown_fragment")}
                content={item.fragment?.content ?? ""}
                enabled={item.enabled}
                active={item.fragmentId === activeDragId}
                t={t}
                onToggle={() => {
                  const nextEnabled = !item.enabled;
                  toggleRecipeItem(currentRecipeId, item.fragmentId, nextEnabled);
                  void persistRecipeItems(
                    currentRecipeItems.map((entry) =>
                      entry.fragmentId === item.fragmentId
                        ? {
                            ...entry,
                            enabled: nextEnabled,
                          }
                        : entry,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeDragItem ? (
            <div
              style={{
                border: "1px solid hsl(var(--primary))",
                borderRadius: 14,
                background: "hsl(var(--card))",
                padding: 12,
                boxShadow: "0 12px 28px rgba(0, 0, 0, 0.18)",
                width: 280,
              }}
            >
              <strong>{activeDragItem.fragment?.name ?? t("unknown_fragment")}</strong>
              <div style={{ fontSize: 12, marginTop: 8, color: "hsl(var(--muted-foreground))" }}>
                {activeDragItem.fragment?.content || t("empty_fragment")}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
