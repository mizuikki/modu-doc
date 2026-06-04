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
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, CopyPlus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getScreenshotDialogMode, isScreenshotMode } from "@/app/screenshotMode";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { FragmentList } from "@/features/fragments/FragmentList";
import { RecipeSelect } from "@/features/recipes/RecipeSelect";
import { SortableFragmentCard } from "@/features/recipes/SortableFragmentCard";
import { createFragment } from "@/lib/api/fragments";
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

type LibraryMode = "insert" | "manage";

function serializeRecipeItem(item: RecipeItemRecord) {
  return {
    id: item.id,
    recipe_id: item.recipeId,
    fragment_id: item.fragmentId,
    enabled: item.enabled,
    sort_order: item.sortOrder,
  };
}

function replaceRecipeItemsInStore(
  recipeId: string,
  nextItems: RecipeItemRecord[],
  nextActiveFragmentId: string | null,
) {
  useAppStore.setState((state) => ({
    recipeItems: [...state.recipeItems.filter((item) => item.recipeId !== recipeId), ...nextItems],
    activeRecipeId: recipeId,
    activeFragmentId: nextActiveFragmentId,
    compileStatus: "compiling",
  }));
}

export function AssemblyBoard() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const activeFragmentId = useAppStore((state) => state.activeFragmentId);
  const fragments = useAppStore((state) => state.fragments);
  const recipes = useAppStore((state) => state.recipes);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const setActiveRecipe = useAppStore((state) => state.setActiveRecipe);
  const setActiveFragment = useAppStore((state) => state.setActiveFragment);
  const reorderRecipeItems = useAppStore((state) => state.reorderRecipeItems);
  const toggleRecipeItem = useAppStore((state) => state.toggleRecipeItem);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("insert");
  const [libraryQuery, setLibraryQuery] = useState("");

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

  useEffect(() => {
    if (!isScreenshotMode()) {
      return;
    }
    const dialogMode = getScreenshotDialogMode();
    if (dialogMode === "insert") {
      setLibraryMode(dialogMode);
      setLibraryQuery("");
      setLibraryDialogOpen(true);
    }
  }, []);

  const currentRecipeItems = useMemo<RecipeItemRecord[]>(
    () =>
      recipeItems
        .filter((item) => item.recipeId === currentRecipeId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [currentRecipeId, recipeItems],
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
      currentRecipeItems.map((item) => ({
        ...item,
        fragment: activeFragmentsById.get(item.fragmentId) ?? null,
      })),
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

  const activeRecipe = workspaceRecipes.find((recipe) => recipe.id === currentRecipeId) ?? null;
  const recipeFragmentIds = new Set(currentRecipeItems.map((item) => item.fragmentId));
  const insertableFragmentCount = fragments.filter(
    (fragment) => fragment.deletedAt === null && !recipeFragmentIds.has(fragment.id),
  ).length;

  const persistRecipeItems = async (nextItems: RecipeItemRecord[]) => {
    if (!currentRecipeId) {
      return false;
    }
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
      return true;
    } catch (error) {
      const message = applyWorkspaceWriteError(setWorkspaceStatusMessage, setCompileStatus, error);
      toast.error(message, t("action_failed"));
      return false;
    }
  };

  const handleCreateFragment = async (closeDialogOnSuccess = false) => {
    if (!activeWorkspaceId) return;
    const result = await dialog.prompt({ title: t("fragment_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      const created = (await createFragment({
        workspaceId: activeWorkspaceId,
        name,
        content: "",
        attachToRecipe: true,
      })) as { id: string };
      setActiveFragment(created.id);
      if (closeDialogOnSuccess) {
        setLibraryDialogOpen(false);
      }
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const openLibraryDialog = (mode: LibraryMode) => {
    setLibraryMode(mode);
    setLibraryQuery("");
    setLibraryDialogOpen(true);
  };

  const appendFragmentToRecipe = async (fragmentId: string) => {
    if (!currentRecipeId || recipeFragmentIds.has(fragmentId)) {
      return;
    }
    const previousItems = currentRecipeItems;
    const nextItems = [
      ...currentRecipeItems,
      {
        id: crypto.randomUUID(),
        recipeId: currentRecipeId,
        fragmentId,
        enabled: true,
        sortOrder: currentRecipeItems.length,
      },
    ];

    replaceRecipeItemsInStore(currentRecipeId, nextItems, fragmentId);
    const success = await persistRecipeItems(nextItems);
    if (!success) {
      replaceRecipeItemsInStore(currentRecipeId, previousItems, activeFragmentId);
      return;
    }

    setActiveFragment(fragmentId);
    setLibraryDialogOpen(false);
  };

  const removeFragmentFromRecipe = async (fragmentId: string) => {
    if (!currentRecipeId) {
      return;
    }
    const previousItems = currentRecipeItems;
    const nextItems = currentRecipeItems
      .filter((item) => item.fragmentId !== fragmentId)
      .map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
    const nextActiveFragmentId =
      activeFragmentId === fragmentId ? (nextItems[0]?.fragmentId ?? null) : activeFragmentId;

    replaceRecipeItemsInStore(currentRecipeId, nextItems, nextActiveFragmentId);
    const success = await persistRecipeItems(nextItems);
    if (!success) {
      replaceRecipeItemsInStore(currentRecipeId, previousItems, activeFragmentId);
      return;
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
    if (!currentRecipeId || !over || active.id === over.id) {
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
          <RecipeSelect />
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
                onClick={() => openLibraryDialog("insert")}
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
                <DropdownMenu.Item
                  data-testid="recipe-manage-library"
                  onSelect={() => {
                    openLibraryDialog("manage");
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
                  {t("manage_library")}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {!currentRecipeId ? (
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
              onClick={() => openLibraryDialog("insert")}
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
            <div style={{ display: "grid", gap: 8 }} data-testid="assembly-items">
              {currentRecipeViews.map((item) => (
                <SortableFragmentCard
                  key={item.id}
                  id={item.fragmentId}
                  name={item.fragment?.name ?? t("unknown_fragment")}
                  summary={item.fragment?.content.trim() || t("empty_fragment")}
                  enabled={item.enabled}
                  active={item.fragmentId === activeDragId}
                  selected={item.fragmentId === activeFragmentId}
                  t={t}
                  onRemove={() => {
                    void removeFragmentFromRecipe(item.fragmentId);
                  }}
                  onSelect={() => setActiveFragment(item.fragmentId)}
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
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {activeDragItem.fragment?.content || t("empty_fragment")}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog.Root open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.42)",
              backdropFilter: "blur(4px)",
              zIndex: 70,
            }}
          />
          <Dialog.Content
            data-testid="fragment-library-dialog"
            aria-label={t("library_dialog_title")}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(720px, calc(100vw - 32px))",
              maxHeight: "82vh",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 16,
              boxShadow: "0 24px 72px rgba(15, 23, 42, 0.22)",
              display: "grid",
              gridTemplateRows: "auto auto minmax(0, 1fr)",
              overflow: "hidden",
              zIndex: 71,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid hsl(var(--border))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <Dialog.Title style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  {t("library_dialog_title")}
                </Dialog.Title>
                <Dialog.Description
                  style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                >
                  {libraryMode === "insert"
                    ? t("library_insert_hint", { count: insertableFragmentCount })
                    : t("library_manage_hint")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  data-testid="fragment-library-close"
                  aria-label={t("close")}
                  title={t("close")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--muted-foreground))",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <X size={14} strokeWidth={1.8} aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: "12px 18px",
                borderBottom: "1px solid hsl(var(--border))",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "start",
                  alignItems: "center",
                  gap: 2,
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 999,
                  padding: 2,
                  background: "hsl(var(--card))",
                }}
              >
                <button
                  type="button"
                  data-testid="fragment-library-mode-insert"
                  onClick={() => setLibraryMode("insert")}
                  aria-pressed={libraryMode === "insert"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 0,
                    height: 28,
                    padding: "0 8px",
                    border: 0,
                    borderRadius: 999,
                    background: libraryMode === "insert" ? "hsl(var(--muted))" : "transparent",
                    color: "hsl(var(--foreground))",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {t("library_add_to_recipe")}
                </button>
                <button
                  type="button"
                  data-testid="fragment-library-mode-manage"
                  onClick={() => setLibraryMode("manage")}
                  aria-pressed={libraryMode === "manage"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 0,
                    height: 28,
                    padding: "0 8px",
                    border: 0,
                    borderRadius: 999,
                    background: libraryMode === "manage" ? "hsl(var(--muted))" : "transparent",
                    color: "hsl(var(--foreground))",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {t("manage_library")}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  data-testid="fragment-library-search"
                  placeholder={t("library_search_placeholder")}
                  aria-label={t("search")}
                  style={{
                    flex: "1 1 220px",
                    minWidth: 180,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFragment(true)}
                  disabled={!activeWorkspaceId}
                  data-testid="fragment-library-new"
                  style={{
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    padding: "8px 12px",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    cursor: activeWorkspaceId ? "pointer" : "not-allowed",
                    opacity: activeWorkspaceId ? 1 : 0.6,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  + {t("new_fragment")}
                </button>
              </div>
            </div>
            <div style={{ minHeight: 0, padding: 18 }}>
              {libraryMode === "insert" ? (
                <FragmentList
                  rootTestId="fragment-library-insert-list"
                  hideHeader
                  filterMode="not_in_recipe"
                  showDeletedSection={false}
                  searchQuery={libraryQuery}
                  emptyMessage={t("no_insertable_fragments")}
                  onAddFragment={(fragmentId) => {
                    void appendFragmentToRecipe(fragmentId);
                  }}
                  onCreateFragment={() => handleCreateFragment(true)}
                />
              ) : (
                <FragmentList
                  rootTestId="fragment-library-manage-list"
                  hideHeader
                  showDeletedSection
                  searchQuery={libraryQuery}
                  onAddFragment={(fragmentId) => {
                    void appendFragmentToRecipe(fragmentId);
                  }}
                  onCreateFragment={() => handleCreateFragment(true)}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
