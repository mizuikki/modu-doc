import { Eye, History, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReadingColumn } from "@/components/layout/ReadingColumn";
import { FragmentEditor } from "@/features/fragments/FragmentEditor";
import { SnapshotDiff } from "@/features/history/SnapshotDiff";
import { SnapshotTimeline } from "@/features/history/SnapshotTimeline";
import { ConflictBanner } from "@/features/sync/ConflictBanner";
import { WorkspacePreview } from "@/features/workspaces/WorkspacePreview";
import { useAppStore } from "@/store/appStore";
import { selectActiveFragment, selectActiveRecipeItem } from "@/store/selectors";

export function MainPanel() {
  const { t } = useTranslation();
  const activeMainTab = useAppStore((state) => state.ui.activeMainTab);
  const setActiveMainTab = useAppStore((state) => state.setActiveMainTab);
  const activeFragment = useAppStore(selectActiveFragment);
  const activeRecipeItem = useAppStore(selectActiveRecipeItem);
  const fragments = useAppStore((state) => state.fragments);
  const iconSize = 13;
  const segmentedStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    flexWrap: "nowrap" as const,
    minWidth: 0,
    border: "1px solid hsl(var(--border))",
    borderRadius: 999,
    padding: 2,
    background: "hsl(var(--card))",
  };
  const toolbarButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minWidth: 0,
    height: 28,
    padding: "0 8px",
    borderRadius: 999,
    border: 0,
    background: "transparent",
    color: "hsl(var(--foreground))",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  };
  const mainTabs = [
    { id: "edit", testId: "main-tab-edit", label: t("edit"), icon: SquarePen },
    { id: "preview", testId: "main-tab-preview", label: t("preview_tab"), icon: Eye },
    { id: "history", testId: "main-tab-history", label: t("history_tab"), icon: History },
  ] as const;
  const workspaceFragmentCount = fragments.filter((fragment) => fragment.deletedAt === null).length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        minHeight: 0,
        height: "100%",
        width: "100%",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          alignItems: "center",
          padding: "8px 12px",
          gap: 8,
          width: "100%",
          minWidth: 0,
        }}
      >
        <div style={{ ...segmentedStyle, flexShrink: 0 }}>
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMainTab(tab.id)}
                data-testid={tab.testId}
                aria-pressed={isActive}
                style={{
                  ...toolbarButtonStyle,
                  background: isActive ? "hsl(var(--muted))" : "transparent",
                }}
              >
                <Icon size={iconSize} strokeWidth={2} aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          overflow: "hidden",
        }}
      >
        <ConflictBanner />
        {activeMainTab === "edit" ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateRows: "auto minmax(0, 1fr)",
              minHeight: 0,
              minWidth: 0,
              width: "100%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                minWidth: 0,
                width: "100%",
                padding: "12px 14px",
                border: "1px solid hsl(var(--border))",
                borderRadius: 14,
                background: "hsl(var(--card))",
              }}
            >
              {activeFragment ? (
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <strong>{activeFragment.name}</strong>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--muted))",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {t("workspace_fragment_total", { count: workspaceFragmentCount })}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: activeRecipeItem
                          ? "1px solid hsl(var(--primary))"
                          : "1px solid hsl(var(--border))",
                        background: activeRecipeItem
                          ? "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)"
                          : "hsl(var(--muted))",
                        color: activeRecipeItem
                          ? "hsl(var(--primary))"
                          : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {activeRecipeItem ? t("fragment_in_recipe") : t("fragment_not_in_recipe")}
                    </span>
                    {activeRecipeItem ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 999,
                          border: activeRecipeItem.enabled
                            ? "1px solid hsl(var(--primary))"
                            : "1px solid hsl(var(--border))",
                          background: activeRecipeItem.enabled
                            ? "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)"
                            : "hsl(var(--muted))",
                          color: activeRecipeItem.enabled
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {activeRecipeItem.enabled ? t("enabled_status") : t("disabled_status")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <strong>{t("editor_empty_title")}</strong>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {t("select_fragment_to_edit")}
                  </div>
                </div>
              )}
            </div>
            <div className="panel-scroll">
              <ReadingColumn>
                <FragmentEditor />
              </ReadingColumn>
            </div>
          </div>
        ) : null}
        {activeMainTab === "preview" ? (
          <div className="panel-scroll">
            <WorkspacePreview />
          </div>
        ) : null}
        {activeMainTab === "history" ? (
          <div className="panel-scroll" style={{ display: "grid", gap: 16 }}>
            <SnapshotTimeline />
            <SnapshotDiff />
          </div>
        ) : null}
      </div>
    </div>
  );
}
