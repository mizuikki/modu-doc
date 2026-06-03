import {
  Columns2,
  Eye,
  FilePenLine,
  GalleryVerticalEnd,
  History,
  RotateCcw,
  SquarePen,
} from "lucide-react";
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
  const splitLeftFraction = Math.max(splitRatio, 0.2);
  const splitRightFraction = Math.max(1 - splitLeftFraction, 0.2);
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
  const compactToolbarButtonStyle = {
    ...toolbarButtonStyle,
    width: 28,
    padding: 0,
  };
  const toolbarGroupStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap" as const,
    minWidth: 0,
  };
  const mainTabs = [
    { id: "edit", testId: "main-tab-edit", label: t("edit"), icon: SquarePen },
    { id: "preview", testId: "main-tab-preview", label: t("preview_tab"), icon: Eye },
    { id: "history", testId: "main-tab-history", label: t("history_tab"), icon: History },
  ] as const;
  const editModes = [
    { id: "fragment", testId: "mode-fragment", label: t("edit_mode_fragment"), icon: FilePenLine },
    {
      id: "continuous",
      testId: "mode-continuous",
      label: t("edit_mode_continuous"),
      icon: GalleryVerticalEnd,
    },
  ] as const;
  const viewModes = [
    { id: "write", testId: "view-mode-write", label: t("view_mode_write"), icon: FilePenLine },
    { id: "split", testId: "view-mode-split", label: t("view_mode_split"), icon: Columns2 },
    { id: "read", testId: "view-mode-read", label: t("view_mode_read"), icon: Eye },
  ] as const;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        minHeight: 0,
        height: "100%",
        width: "100%",
        minWidth: 0,
        cursor: isResizing ? "col-resize" : undefined,
        userSelect: isResizing ? "none" : undefined,
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
        {activeMainTab === "edit" ? (
          <div
            style={{
              ...toolbarGroupStyle,
              justifyContent: "flex-end",
              width: "100%",
              justifySelf: "end",
            }}
          >
            <div
              data-testid="edit-mode-toggle"
              style={{
                ...segmentedStyle,
                flexShrink: 0,
              }}
            >
              {editModes.map((entry) => {
                const Icon = entry.icon;
                const isActive = continuousMode === (entry.id === "continuous");
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setContinuousMode(entry.id === "continuous")}
                    data-testid={entry.testId}
                    aria-pressed={isActive}
                    aria-label={entry.label}
                    title={entry.label}
                    style={{
                      ...(isActive ? toolbarButtonStyle : compactToolbarButtonStyle),
                      background: isActive ? "hsl(var(--primary))" : "transparent",
                      color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    }}
                  >
                    <Icon size={iconSize} strokeWidth={2} aria-hidden />
                    {isActive ? entry.label : null}
                  </button>
                );
              })}
            </div>
            <div
              data-testid="view-mode-toggle"
              style={{
                ...segmentedStyle,
                flexShrink: 0,
              }}
            >
              {viewModes.map((entry) => {
                const Icon = entry.icon;
                const isActive = viewMode === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setViewMode(entry.id)}
                    data-testid={entry.testId}
                    aria-pressed={isActive}
                    aria-label={entry.label}
                    title={entry.label}
                    style={{
                      ...(isActive ? toolbarButtonStyle : compactToolbarButtonStyle),
                      background: isActive ? "hsl(var(--primary))" : "transparent",
                      color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    }}
                  >
                    <Icon size={iconSize} strokeWidth={2} aria-hidden />
                    {isActive ? entry.label : null}
                  </button>
                );
              })}
            </div>
            {viewMode === "split" ? (
              <button
                type="button"
                onClick={() => setSplitRatio(0.5)}
                data-testid="reset-split-button"
                aria-label={t("reset_split")}
                title={t("reset_split")}
                style={{
                  ...compactToolbarButtonStyle,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={iconSize} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
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
              {continuousMode ? (
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <strong>{t("continuous_workspace_title")}</strong>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {t("continuous_workspace_hint", {
                      enabled: enabledCount,
                      total: recipeCount,
                    })}
                  </div>
                </div>
              ) : activeFragment ? (
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
            <div
              style={{
                minHeight: 0,
                minWidth: 0,
                width: "100%",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
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
                    gridTemplateColumns: `minmax(0, ${splitLeftFraction}fr) 10px minmax(0, ${splitRightFraction}fr)`,
                    minHeight: 0,
                    minWidth: 0,
                    width: "100%",
                    overflow: "hidden",
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
