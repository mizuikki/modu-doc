import { useTranslation } from "react-i18next";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { createFragment, restoreFragment, softDeleteFragment } from "@/lib/api/fragments";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";

export function FragmentList() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const activeFragmentId = useAppStore((state) => state.activeFragmentId);
  const setActiveFragment = useAppStore((state) => state.setActiveFragment);

  const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
  const deletedFragments = fragments
    .filter((fragment) => fragment.deletedAt !== null)
    .slice()
    .sort((a, b) => {
      const aTime = a.deletedAt ? Date.parse(a.deletedAt) : 0;
      const bTime = b.deletedAt ? Date.parse(b.deletedAt) : 0;
      return bTime - aTime;
    });

  const activeFragmentOrder = new Map<string, number>();
  if (activeRecipeId) {
    recipeItems
      .filter((item) => item.recipeId === activeRecipeId)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((item, index) => {
        activeFragmentOrder.set(item.fragmentId, index);
      });
  }

  const orderedActiveFragments = activeFragments.slice().sort((a, b) => {
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

  const handleDeleteFragment = async (fragmentId: string) => {
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
      style={{
        padding: 16,
        borderTop: "1px solid hsl(var(--border))",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        minHeight: 0,
        gap: 12,
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}
      >
        <h3 style={{ margin: 0 }}>{t("fragments")}</h3>
        <button
          type="button"
          onClick={handleCreateFragment}
          disabled={!activeWorkspaceId}
          data-testid="fragments-new"
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
      <div
        style={{
          overflowY: "auto",
          minHeight: 0,
          paddingRight: 4,
          paddingBottom: 8,
          display: "grid",
          alignContent: "start",
          gap: 8,
        }}
      >
        {orderedActiveFragments.map((fragment) => (
          <div
            key={fragment.id}
            style={{
              display: "grid",
              gap: 6,
              textAlign: "left",
              borderRadius: 10,
              border:
                fragment.id === activeFragmentId
                  ? "1px solid hsl(var(--primary))"
                  : "1px solid hsl(var(--border))",
              background: "transparent",
              padding: 10,
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
              }}
            >
              <div>{fragment.name}</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                {fragment.content.slice(0, 60)}
              </div>
            </button>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => void handleDeleteFragment(fragment.id)}
                data-testid={`fragment-delete-${fragment.id}`}
              >
                {t("delete_fragment")}
              </button>
            </div>
          </div>
        ))}
        <div style={{ display: "grid", gap: 8 }}>
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
                  gap: 6,
                  textAlign: "left",
                  borderRadius: 10,
                  border: "1px solid hsl(var(--border))",
                  background: "transparent",
                  padding: 10,
                  opacity: 0.7,
                }}
              >
                <div>{fragment.name}</div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {fragment.content.slice(0, 60)}
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
      </div>
    </div>
  );
}
