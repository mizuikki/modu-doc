import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { tMaybe } from "@/i18n/tMaybe";
import { openTargetInFileManager } from "@/lib/api/misc";
import { logDebugPerf } from "@/lib/debugPerf";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export function WorkspacePreview() {
  const { t } = useTranslation();
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const totalCount = recipeItems.filter((item) => item.recipeId === activeRecipeId).length;
  const enabledCount = recipeItems.filter(
    (item) => item.recipeId === activeRecipeId && item.enabled,
  ).length;

  const compiled = useMemo(() => {
    const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
    const activeFragmentIds = new Set(activeFragments.map((fragment) => fragment.id));
    const fragmentContentById = new Map(
      activeFragments.map((fragment) => [fragment.id, fragment.content]),
    );
    const orderedItems = recipeItems
      .filter((item) => item.recipeId === activeRecipeId && item.enabled)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return orderedItems
      .filter((item) => activeFragmentIds.has(item.fragmentId))
      .map((item) => fragmentContentById.get(item.fragmentId) ?? "")
      .join("\n\n");
  }, [activeRecipeId, fragments, recipeItems]);

  useEffect(() => {
    void logDebugPerf("main-tab ready:preview", {
      workspaceId: activeWorkspace?.id ?? null,
      recipeId: activeRecipeId,
      compiledBytes: compiled.length,
      enabledCount,
      totalCount,
    });
  }, [activeRecipeId, activeWorkspace?.id, compiled.length, enabledCount, totalCount]);

  return (
    <div style={{ padding: 20, display: "grid", gap: 16 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <section
          style={{
            border: "1px solid hsl(var(--border))",
            borderRadius: 20,
            padding: 20,
            background:
              "linear-gradient(180deg, hsl(var(--card)), color-mix(in srgb, hsl(var(--muted)) 30%, hsl(var(--card))))",
            boxShadow: "var(--elevation-1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                {t("preview")}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {activeWorkspace?.name ?? t("no_workspace")}
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {t("last_written_at")}: {activeWorkspace?.lastCompiledAt ?? t("missing_target")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {t("fragment_count", { count: totalCount })}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid hsl(var(--primary))",
                    background: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)",
                    color: "hsl(var(--primary))",
                  }}
                >
                  {t("enabled_count", { enabled: enabledCount })}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {t("status")}:{" "}
                  {activeWorkspace?.status
                    ? tMaybe(t, activeWorkspace.status)
                    : t("missing_target")}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  overflowWrap: "anywhere",
                }}
              >
                <strong>{t("current_target")}:</strong>{" "}
                {activeWorkspace?.targetPath ?? t("missing_target")}
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
        </section>

        <section
          style={{
            border: "1px solid hsl(var(--border))",
            borderRadius: 22,
            padding: "22px 24px",
            minHeight: 320,
            background: "hsl(var(--card))",
            boxShadow: "var(--elevation-1)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
              marginBottom: 14,
            }}
          >
            {t("preview")}
          </div>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {compiled || t("empty_fragment")}
            </ReactMarkdown>
          </div>
        </section>
      </div>
    </div>
  );
}
