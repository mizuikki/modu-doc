import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { tMaybe } from "@/i18n/tMaybe";
import { openTargetInFileManager } from "@/lib/api/misc";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export function WorkspacePreview() {
  const { t } = useTranslation();
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);

  const compiled = useMemo(() => {
    const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
    const activeFragmentIds = new Set(activeFragments.map((fragment) => fragment.id));
    const orderedItems = recipeItems
      .filter((item) => item.recipeId === activeRecipeId && item.enabled)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return orderedItems
      .filter((item) => activeFragmentIds.has(item.fragmentId))
      .map(
        (item) =>
          activeFragments.find((fragment) => fragment.id === item.fragmentId)?.content ?? "",
      )
      .join("\n\n");
  }, [activeRecipeId, fragments, recipeItems]);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{t("preview")}</div>
          <div style={{ fontWeight: 600 }}>{activeWorkspace?.name ?? t("no_workspace")}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {t("current_target")}: {activeWorkspace?.targetPath ?? t("missing_target")}
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {t("status")}:{" "}
            {activeWorkspace?.status ? tMaybe(t, activeWorkspace.status) : t("missing_target")}
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {t("last_written_at")}: {activeWorkspace?.lastCompiledAt ?? t("missing_target")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!activeWorkspace?.targetPath) return;
            void openTargetInFileManager(activeWorkspace.id);
          }}
          disabled={!activeWorkspace?.targetPath}
          data-testid="preview-open-target-folder"
        >
          {t("open_target_folder")}
        </button>
      </div>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{compiled || t("empty_fragment")}</ReactMarkdown>
      </div>
    </div>
  );
}
