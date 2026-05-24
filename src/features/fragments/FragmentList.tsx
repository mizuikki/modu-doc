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
  const fragments = useAppStore((state) => state.fragments);
  const activeFragmentId = useAppStore((state) => state.activeFragmentId);
  const setActiveFragment = useAppStore((state) => state.setActiveFragment);
  const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
  const deletedFragments = fragments.filter((fragment) => fragment.deletedAt !== null);

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
    <div style={{ padding: 16, borderTop: "1px solid hsl(var(--border))" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}
      >
        <h3>{t("fragments")}</h3>
        <button
          type="button"
          onClick={handleCreateFragment}
          disabled={!activeWorkspaceId}
          data-testid="fragments-new"
        >
          {t("new_fragment")}
        </button>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {t("fragments")}
          </div>
          {activeFragments.map((fragment) => (
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
                padding: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveFragment(fragment.id)}
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
        </div>
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
                  padding: 8,
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
