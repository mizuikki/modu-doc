import { useTranslation } from "react-i18next";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { createFragment, restoreFragment, softDeleteFragment } from "@/lib/api/fragments";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";

type FragmentListProps = {
  createButtonTestId?: string;
  emptyMessage?: string;
  filterMode?: "all" | "not_in_recipe";
  hideHeader?: boolean;
  onAddFragment?: (fragmentId: string) => void;
  onCreateFragment?: () => Promise<void> | void;
  rootTestId?: string;
  searchQuery?: string;
  showDeletedSection?: boolean;
  title?: string;
};

function statusChip(label: string, tone: "primary" | "muted") {
  return (
    <span
      style={{
        fontSize: 11,
        lineHeight: 1.2,
        padding: "3px 8px",
        borderRadius: 999,
        border:
          tone === "primary" ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
        color: tone === "primary" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
        background:
          tone === "primary"
            ? "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)"
            : "hsl(var(--muted))",
      }}
    >
      {label}
    </span>
  );
}

export function FragmentList({
  createButtonTestId = "fragments-new",
  emptyMessage,
  filterMode = "all",
  hideHeader = false,
  onAddFragment,
  onCreateFragment,
  rootTestId = "content-manager-fragments",
  searchQuery = "",
  showDeletedSection = true,
  title,
}: FragmentListProps = {}) {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const activeFragmentId = useAppStore((state) => state.activeFragmentId);
  const setActiveFragment = useAppStore((state) => state.setActiveFragment);

  const activeRecipeItems = activeRecipeId
    ? recipeItems
        .filter((item) => item.recipeId === activeRecipeId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const activeRecipeItemByFragmentId = new Map(
    activeRecipeItems.map((item) => [item.fragmentId, item] as const),
  );

  const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
  const filteredActiveFragments = activeFragments.filter((fragment) => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (normalizedQuery) {
      const haystack = `${fragment.name}\n${fragment.content}`.toLocaleLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    if (filterMode === "not_in_recipe") {
      return !activeRecipeItemByFragmentId.has(fragment.id);
    }
    return true;
  });
  const deletedFragments = showDeletedSection
    ? fragments
        .filter((fragment) => fragment.deletedAt !== null)
        .slice()
        .sort((a, b) => {
          const aTime = a.deletedAt ? Date.parse(a.deletedAt) : 0;
          const bTime = b.deletedAt ? Date.parse(b.deletedAt) : 0;
          return bTime - aTime;
        })
    : [];

  const activeFragmentOrder = new Map<string, number>();
  activeRecipeItems.forEach((item, index) => {
    activeFragmentOrder.set(item.fragmentId, index);
  });

  const orderedActiveFragments = filteredActiveFragments.slice().sort((a, b) => {
    const aInRecipe = activeFragmentOrder.has(a.id);
    const bInRecipe = activeFragmentOrder.has(b.id);
    if (aInRecipe && bInRecipe) {
      return (activeFragmentOrder.get(a.id) ?? 0) - (activeFragmentOrder.get(b.id) ?? 0);
    }
    if (aInRecipe !== bInRecipe) {
      return aInRecipe ? -1 : 1;
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name);
  });

  const handleCreateFragment = async () => {
    if (onCreateFragment) {
      await onCreateFragment();
      return;
    }
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
        attachToRecipe: true,
      });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleDeleteFragment = async (fragmentId: string, fragmentName: string) => {
    const ok = await dialog.confirm({
      title: t("delete_fragment_confirm_title"),
      description: `${t("confirm_delete_fragment")}\n\n${fragmentName}`,
      confirmText: t("delete_fragment"),
      cancelText: t("cancel"),
      danger: true,
    });
    if (!ok) return;
    try {
      await softDeleteFragment(fragmentId);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleRestoreFragment = async (fragmentId: string) => {
    try {
      await restoreFragment(fragmentId);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  return (
    <div
      data-testid={rootTestId}
      style={{
        display: "grid",
        gridTemplateRows: hideHeader ? "minmax(0, 1fr)" : "auto minmax(0, 1fr)",
        minHeight: 0,
        gap: 12,
      }}
    >
      {hideHeader ? null : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <h3 style={{ margin: 0 }}>{title ?? t("fragments")}</h3>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {t("fragment_library_hint")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateFragment()}
            disabled={!activeWorkspaceId}
            data-testid={createButtonTestId}
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
      )}
      <div
        style={{
          overflowY: "auto",
          minHeight: 0,
          paddingRight: 4,
          paddingBottom: 8,
          display: "grid",
          alignContent: "start",
          gap: 10,
        }}
      >
        {orderedActiveFragments.length === 0 ? (
          <div
            style={{
              border: "1px dashed hsl(var(--border))",
              borderRadius: 14,
              padding: 16,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {emptyMessage ?? t("no_fragments_yet")}
          </div>
        ) : null}
        {orderedActiveFragments.map((fragment) => {
          const recipeItem = activeRecipeItemByFragmentId.get(fragment.id);
          const preview = fragment.content.trim() || t("empty_fragment");
          const isSelected = fragment.id === activeFragmentId;
          return (
            <div
              key={fragment.id}
              style={{
                display: "grid",
                gap: 8,
                border: isSelected
                  ? "1px solid hsl(var(--primary))"
                  : "1px solid hsl(var(--border))",
                borderRadius: 14,
                background: isSelected
                  ? "color-mix(in srgb, hsl(var(--primary)) 6%, hsl(var(--card)))"
                  : "hsl(var(--card))",
                padding: 12,
                boxShadow: isSelected ? "var(--elevation-1)" : "none",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveFragment(fragment.id)}
                data-testid={`fragment-select-${fragment.id}`}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  color: "inherit",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fragment.name}
                  </strong>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {recipeItem
                      ? statusChip(t("fragment_in_recipe"), "primary")
                      : statusChip(t("fragment_not_in_recipe"), "muted")}
                    {recipeItem
                      ? statusChip(
                          recipeItem.enabled ? t("enabled_status") : t("disabled_status"),
                          recipeItem.enabled ? "primary" : "muted",
                        )
                      : null}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "hsl(var(--muted-foreground))",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {preview}
                </div>
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                {onAddFragment && !recipeItem ? (
                  <button
                    type="button"
                    onClick={() => onAddFragment(fragment.id)}
                    data-testid={`fragment-add-${fragment.id}`}
                  >
                    {t("add_fragment")}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => void handleDeleteFragment(fragment.id, fragment.name)}
                  data-testid={`fragment-delete-${fragment.id}`}
                  style={{
                    color: "hsl(8 70% 45%)",
                    border: "1px solid color-mix(in srgb, hsl(8 70% 45%) 25%, transparent)",
                    background: "transparent",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {t("delete_fragment")}
                </button>
              </div>
            </div>
          );
        })}
        {showDeletedSection ? (
          <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {t("deleted_fragments")}
            </div>
            {deletedFragments.length === 0 ? (
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>-</div>
            ) : (
              deletedFragments.map((fragment) => (
                <div
                  key={fragment.id}
                  style={{
                    display: "grid",
                    gap: 8,
                    borderRadius: 14,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    padding: 12,
                    opacity: 0.72,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>{fragment.name}</strong>
                    <div
                      style={{
                        fontSize: 12,
                        color: "hsl(var(--muted-foreground))",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {fragment.content.trim() || t("empty_fragment")}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => void handleRestoreFragment(fragment.id)}
                      data-testid={`fragment-restore-${fragment.id}`}
                    >
                      {t("restore")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
