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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, CopyPlus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { FragmentList } from "@/features/fragments/FragmentList";
import { SortableFragmentCard } from "@/features/recipes/SortableFragmentCard";
import { createFragment } from "@/lib/api/fragments";
import { createRecipe, updateRecipeItems } from "@/lib/api/recipes";
import { normalizeAppError } from "@/lib/appError";
import { summarizeForPreview } from "@/lib/markdownPreview";
import { useAppStore } from "@/store/appStore";

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

/**
 * Recipe is no longer the default editing path. The board is now an
 * advanced editor opened from the right panel's Recipes tab (or a command
 * palette action). It edits a single recipe, picked via local panel state
 * and fed in as the `recipeId` prop (or the first non-deleted recipe of the
 * active workspace if `null`).
 */
export function AssemblyBoard({ recipeId: initialRecipeId = null }: { recipeId?: string | null }) {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const fragments = useAppStore((state) => state.fragments);
  const recipes = useAppStore((state) => state.recipes);
  const recipeItems = useAppStore((state) => state.recipeItems);

  const [recipeId, setRecipeId] = useState<string | null>(initialRecipeId);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const workspaceRecipes = useMemo(
    () =>
      recipes.filter(
        (recipe) => recipe.workspaceId === activeWorkspaceId && recipe.deletedAt === null,
      ),
    [recipes, activeWorkspaceId],
  );

  // Default to the first non-deleted recipe in the workspace if no explicit
  // id is given. (The right panel is the long-term owner of this selection.)
  useEffect(() => {
    if (recipeId) return;
    if (workspaceRecipes[0]) {
      setRecipeId(workspaceRecipes[0].id);
    }
  }, [recipeId, workspaceRecipes]);

  const currentRecipeItems = useMemo<RecipeItemRecord[]>(
    () =>
      recipeItems
        .filter((item) => item.recipeId === recipeId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [recipeId, recipeItems],
  );

  const activeFragmentsById = useMemo(() => {
    const map = new Map<string, (typeof fragments)[number]>();
    for (const fragment of fragments) {
      if (fragment.deletedAt === null) {
        map.set(fragment.id, fragment);
      }
    }
    return map;
  }, [fragments]);

  const currentRecipeViews = useMemo(
    () =>
      currentRecipeItems.map((item) => {
        const fragment = activeFragmentsById.get(item.fragmentId) ?? null;
        return {
          ...item,
          fragment,
          summary: summarizeForPreview(fragment?.content ?? ""),
        };
      }),
    [activeFragmentsById, currentRecipeItems],
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

  const activeRecipe = workspaceRecipes.find((recipe) => recipe.id === recipeId) ?? null;
  const recipeFragmentIds = new Set(currentRecipeItems.map((item) => item.fragmentId));
  const insertableFragmentCount = fragments.filter(
    (fragment) => fragment.deletedAt === null && !recipeFragmentIds.has(fragment.id),
  ).length;

  const persistRecipeItems = async (nextItems: RecipeItemRecord[]) => {
    if (!recipeId) {
      return false;
    }
    try {
      await updateRecipeItems({
        recipeId,
        items: nextItems.map(serializeRecipeItem),
      });
      return true;
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
      return false;
    }
  };

  const handleCreateFragment = async () => {
    if (!activeWorkspaceId) return;
    const result = await dialog.prompt({ title: t("fragment_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      await createFragment({
        workspaceId: activeWorkspaceId,
        name,
        content: "",
      });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const appendFragmentToRecipe = async (fragmentId: string) => {
    if (!recipeId || recipeFragmentIds.has(fragmentId)) {
      return;
    }
    const nextItems: RecipeItemRecord[] = [
      ...currentRecipeItems,
      {
        id: crypto.randomUUID(),
        recipeId,
        fragmentId,
        enabled: true,
        sortOrder: currentRecipeItems.length,
      },
    ];
    await persistRecipeItems(nextItems);
  };

  const removeFragmentFromRecipe = async (fragmentId: string) => {
    if (!recipeId) {
      return;
    }
    const nextItems = currentRecipeItems
      .filter((item) => item.fragmentId !== fragmentId)
      .map((item, index) => ({ ...item, sortOrder: index }));
    await persistRecipeItems(nextItems);
  };

  const cloneRecipe = async () => {
    if (!activeWorkspaceId || !recipeId) return;
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
      setRecipeId(recipe.id);
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
    if (!recipeId || !over || active.id === over.id) {
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
    void persistRecipeItems(
      currentRecipeItems.map((item) => ({
        ...item,
        sortOrder: next.indexOf(item.fragmentId),
      })),
    );
  };

  const enabledCount = currentRecipeItems.filter((item) => item.enabled).length;

  return (
    <div
      className="panel-scroll"
      style={{ padding: 12, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 12 }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t("current_recipe_title")}</h2>
          <span
            data-testid="recipe-compile-badge"
            title={t("continuous_workspace_hint", {
              enabled: enabledCount,
              total: currentRecipeItems.length,
            })}
            style={{
              fontSize: 11,
              lineHeight: 1.2,
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {enabledCount}/{currentRecipeItems.length}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "hsl(var(--muted-foreground))",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {t("current_recipe_hint")}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            padding: "8px 10px",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            background: "hsl(var(--card))",
          }}
        >
          <button
            type="button"
            onClick={cloneRecipe}
            disabled={!currentRecipeItems.length}
            data-testid="recipe-save-as-new"
            aria-label={t("save_as_new_recipe")}
            title={t("save_as_new_recipe")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              padding: 0,
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
              flexShrink: 0,
            }}
          >
            <CopyPlus size={15} strokeWidth={1.8} aria-hidden />
          </button>
          <DropdownMenu.Root>
            <div
              style={{
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => void appendFragmentToRecipe(insertableFragmentCount > 0 ? "" : "")}
                data-testid="recipe-add-fragment"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid hsl(var(--primary))",
                  borderRight: 0,
                  borderRadius: "10px 0 0 10px",
                  padding: "7px 10px",
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  whiteSpace: "nowrap",
                }}
              >
                <Plus size={14} strokeWidth={2} aria-hidden />
                {t("add_fragment")}
              </button>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  data-testid="recipe-add-fragment-menu"
                  aria-label={t("fragment_actions")}
                  title={t("fragment_actions")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid hsl(var(--primary))",
                    borderRadius: "0 10px 10px 0",
                    padding: "7px 8px",
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <ChevronDown size={14} strokeWidth={2} aria-hidden />
                </button>
              </DropdownMenu.Trigger>
            </div>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                data-testid="recipe-add-fragment-menu-content"
                style={{
                  minWidth: 200,
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  padding: 6,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.14)",
                  zIndex: 60,
                }}
              >
                <DropdownMenu.Item
                  data-testid="fragments-new"
                  onSelect={() => {
                    void handleCreateFragment();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "hsl(var(--foreground))",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  + {t("new_fragment")}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {!recipeId ? (
        <div
          style={{
            border: "1px dashed hsl(var(--border))",
            borderRadius: 14,
            padding: 16,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {t("no_active_recipe")}
        </div>
      ) : currentRecipeViews.length === 0 ? (
        <div
          style={{
            border: "1px dashed hsl(var(--border))",
            borderRadius: 14,
            padding: 16,
            display: "grid",
            gap: 8,
            alignContent: "start",
          }}
        >
          <strong>{t("no_recipe_fragments_yet")}</strong>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {t("recipe_empty_hint")}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              data-testid="recipe-empty-add-fragment"
              style={{
                border: "1px solid hsl(var(--primary))",
                borderRadius: 10,
                padding: "6px 10px",
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              + {t("add_fragment")}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateFragment()}
              disabled={!activeWorkspaceId}
              style={{
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                padding: "6px 10px",
                background: "hsl(var(--card))",
              }}
            >
              + {t("new_fragment")}
            </button>
          </div>
        </div>
      ) : (
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
            <div
              style={{ display: "grid", gap: 8, alignContent: "start" }}
              data-testid="assembly-items"
            >
              {currentRecipeViews.map((item) => (
                <SortableFragmentCard
                  key={item.id}
                  id={item.fragmentId}
                  name={item.fragment?.name ?? t("unknown_fragment")}
                  summary={item.summary || t("empty_fragment")}
                  enabled={item.enabled}
                  active={item.fragmentId === activeDragId}
                  selected={false}
                  t={t}
                  onRemove={() => {
                    void removeFragmentFromRecipe(item.fragmentId);
                  }}
                  onSelect={() => undefined}
                  onToggle={() => {
                    void persistRecipeItems(
                      currentRecipeItems.map((entry) =>
                        entry.fragmentId === item.fragmentId
                          ? { ...entry, enabled: !entry.enabled }
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
                  background: "color-mix(in srgb, hsl(var(--primary)) 7%, hsl(var(--card)))",
                  padding: 12,
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.2)",
                  width: 280,
                }}
              >
                <strong>{activeDragItem.fragment?.name ?? t("unknown_fragment")}</strong>
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                    color: "hsl(var(--muted-foreground-strong))",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    maskImage: "linear-gradient(to right, rgba(0,0,0,1) 85%, rgba(0,0,0,0))",
                    WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 85%, rgba(0,0,0,0))",
                    maskMode: "alpha",
                    WebkitMaskMode: "alpha",
                  }}
                >
                  {summarizeForPreview(activeDragItem.fragment?.content ?? "") ||
                    t("empty_fragment")}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Library manager (no dialog wrapper here — owners render this inside
          the right panel or a modal). Kept as a slot for downstream consumers. */}
      <div data-testid="assembly-library-slot" hidden>
        <FragmentList
          rootTestId="fragment-library-insert-list"
          hideHeader
          filterMode="not_in_recipe"
          showDeletedSection={false}
          emptyMessage={t("no_insertable_fragments")}
          onAddFragment={(fragmentId) => {
            void appendFragmentToRecipe(fragmentId);
          }}
          onCreateFragment={() => handleCreateFragment()}
        />
      </div>
    </div>
  );
}
