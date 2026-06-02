import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReadingColumn } from "@/components/layout/ReadingColumn";
import { ContinuousEditor } from "@/features/fragments/ContinuousEditor";
import { FragmentEditor } from "@/features/fragments/FragmentEditor";
import { FragmentPreview } from "@/features/fragments/FragmentPreview";
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
  const splitRatio = useAppStore((state) => state.ui.splitRatio);
  const setSplitRatio = useAppStore((state) => state.setSplitRatio);
  const viewMode = useAppStore((state) => state.ui.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const continuousMode = useAppStore((state) => state.ui.continuousMode);
  const setContinuousMode = useAppStore((state) => state.setContinuousMode);
  const activeFragment = useAppStore(selectActiveFragment);
  const activeRecipeItem = useAppStore(selectActiveRecipeItem);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const resizeRef = useRef(false);
  const splitPaneRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const enabledCount = recipeItems.filter(
    (item) => item.recipeId === activeRecipeId && item.enabled,
  ).length;
  const recipeCount = recipeItems.filter((item) => item.recipeId === activeRecipeId).length;
  const workspaceFragmentCount = fragments.filter((fragment) => fragment.deletedAt === null).length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "48px minmax(0, 1fr)",
        minHeight: 0,
        height: "100%",
        cursor: isResizing ? "col-resize" : undefined,
        userSelect: isResizing ? "none" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
        <button
          type="button"
          onClick={() => setActiveMainTab("edit")}
          data-testid="main-tab-edit"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: activeMainTab === "edit" ? "hsl(var(--muted))" : "hsl(var(--card))",
          }}
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("preview")}
          data-testid="main-tab-preview"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: activeMainTab === "preview" ? "hsl(var(--muted))" : "hsl(var(--card))",
          }}
        >
          {t("preview_tab")}
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("history")}
          data-testid="main-tab-history"
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: activeMainTab === "history" ? "hsl(var(--muted))" : "hsl(var(--card))",
          }}
        >
          {t("history_tab")}
        </button>
        {activeMainTab === "edit" ? (
          <div
            data-testid="edit-mode-toggle"
            style={{
              marginLeft: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid hsl(var(--border))",
              borderRadius: 999,
              padding: 2,
              background: "hsl(var(--card))",
            }}
          >
            <span style={{ fontSize: 12, padding: "0 6px", color: "hsl(var(--muted-foreground))" }}>
              {t("edit_mode_label")}
            </span>
            {(
              [
                { mode: "fragment", label: t("edit_mode_fragment") },
                { mode: "continuous", label: t("edit_mode_continuous") },
              ] as const
            ).map((entry) => {
              const isActive = continuousMode === (entry.mode === "continuous");
              return (
                <button
                  key={entry.mode}
                  type="button"
                  onClick={() => setContinuousMode(entry.mode === "continuous")}
                  data-testid={`mode-${entry.mode}`}
                  aria-pressed={isActive}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: 0,
                    background: isActive ? "hsl(var(--primary))" : "transparent",
                    color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {activeMainTab === "edit" ? (
          <div
            data-testid="view-mode-toggle"
            style={{
              marginLeft: 6,
              display: "inline-flex",
              gap: 0,
              border: "1px solid hsl(var(--border))",
              borderRadius: 999,
              padding: 2,
              background: "hsl(var(--card))",
            }}
          >
            {(
              [
                { mode: "write", label: t("view_mode_write"), icon: "✎" },
                { mode: "split", label: t("view_mode_split"), icon: "⇅" },
                { mode: "read", label: t("view_mode_read"), icon: "👁" },
              ] as const
            ).map((entry) => {
              const isActive = viewMode === entry.mode;
              return (
                <button
                  key={entry.mode}
                  type="button"
                  onClick={() => setViewMode(entry.mode)}
                  data-testid={`view-mode-${entry.mode}`}
                  aria-pressed={isActive}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: 0,
                    background: isActive ? "hsl(var(--primary))" : "transparent",
                    color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <span aria-hidden style={{ marginRight: 4 }}>
                    {entry.icon}
                  </span>
                  {entry.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {activeMainTab === "edit" && viewMode === "split" ? (
          <button
            type="button"
            onClick={() => setSplitRatio(0.5)}
            style={{
              marginLeft: 6,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            {t("reset_split")}
          </button>
        ) : null}
        <span style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ display: "grid", gap: 12, padding: 16, minHeight: 0, overflow: "hidden" }}>
        <ConflictBanner />
        {activeMainTab === "edit" ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateRows: "auto minmax(0, 1fr)",
              minHeight: 0,
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
                padding: "12px 14px",
                border: "1px solid hsl(var(--border))",
                borderRadius: 14,
                background: "hsl(var(--card))",
              }}
            >
              {continuousMode ? (
                <div style={{ display: "grid", gap: 2 }}>
                  <strong>{t("continuous_workspace_title")}</strong>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {t("continuous_workspace_hint", {
                      enabled: enabledCount,
                      total: recipeCount,
                    })}
                  </div>
                </div>
              ) : activeFragment ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <strong>{activeFragment.name}</strong>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                <div style={{ display: "grid", gap: 2 }}>
                  <strong>{t("editor_empty_title")}</strong>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {t("select_fragment_to_edit")}
                  </div>
                </div>
              )}
            </div>
            <div style={{ minHeight: 0, overflow: "auto" }}>
              {viewMode === "write" ? (
                <ReadingColumn>
                  {continuousMode ? <ContinuousEditor /> : <FragmentEditor />}
                </ReadingColumn>
              ) : null}
              {viewMode === "split" ? (
                <div
                  data-main-split
                  ref={splitPaneRef}
                  id="main-split-pane"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${Math.round(splitRatio * 1000) / 10}% 10px ${
                      Math.round((1 - splitRatio) * 1000) / 10
                    }%`,
                    minHeight: 0,
                  }}
                >
                  <ReadingColumn>
                    {continuousMode ? <ContinuousEditor /> : <FragmentEditor />}
                  </ReadingColumn>
                  <button
                    type="button"
                    aria-label={t("resize_split")}
                    aria-controls="main-split-pane"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      resizeRef.current = true;
                      setIsResizing(true);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (!resizeRef.current) return;
                      const pane = splitPaneRef.current;
                      if (!pane) return;
                      const rect = pane.getBoundingClientRect();
                      const next = (event.clientX - rect.left) / rect.width;
                      setSplitRatio(next);
                    }}
                    onPointerUp={(event) => {
                      if (!resizeRef.current) return;
                      resizeRef.current = false;
                      setIsResizing(false);
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => {
                      resizeRef.current = false;
                      setIsResizing(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        setSplitRatio(splitRatio - 0.05);
                      }
                      if (event.key === "ArrowRight") {
                        event.preventDefault();
                        setSplitRatio(splitRatio + 0.05);
                      }
                      if (event.key === "Home") {
                        event.preventDefault();
                        setSplitRatio(0.2);
                      }
                      if (event.key === "End") {
                        event.preventDefault();
                        setSplitRatio(0.8);
                      }
                    }}
                    onDoubleClick={() => setSplitRatio(0.5)}
                    style={{
                      border: 0,
                      background: "transparent",
                      cursor: "col-resize",
                      display: "grid",
                      placeItems: "center",
                      color: "hsl(var(--muted-foreground))",
                      padding: "12px 0",
                    }}
                  >
                    <span
                      style={{
                        width: 2,
                        height: "100%",
                        borderRadius: 999,
                        background: "currentColor",
                        opacity: 0.7,
                      }}
                    />
                  </button>
                  <ReadingColumn>
                    <FragmentPreview />
                  </ReadingColumn>
                </div>
              ) : null}
              {viewMode === "read" ? (
                <ReadingColumn>
                  <FragmentPreview />
                </ReadingColumn>
              ) : null}
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
