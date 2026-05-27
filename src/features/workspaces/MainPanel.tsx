import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FragmentEditor } from "@/features/fragments/FragmentEditor";
import { FragmentList } from "@/features/fragments/FragmentList";
import { FragmentPreview } from "@/features/fragments/FragmentPreview";
import { SnapshotDiff } from "@/features/history/SnapshotDiff";
import { SnapshotTimeline } from "@/features/history/SnapshotTimeline";
import { ConflictBanner } from "@/features/sync/ConflictBanner";
import { WorkspacePreview } from "@/features/workspaces/WorkspacePreview";
import { useAppStore } from "@/store/appStore";

export function MainPanel() {
  const { t } = useTranslation();
  const activeMainTab = useAppStore((state) => state.ui.activeMainTab);
  const setActiveMainTab = useAppStore((state) => state.setActiveMainTab);
  const splitRatio = useAppStore((state) => state.ui.splitRatio);
  const setSplitRatio = useAppStore((state) => state.setSplitRatio);
  const resizeRef = useRef(false);
  const splitPaneRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "48px minmax(0, 1fr)",
        minHeight: "100%",
        cursor: isResizing ? "col-resize" : undefined,
        userSelect: isResizing ? "none" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <button type="button" onClick={() => setActiveMainTab("edit")} data-testid="main-tab-edit">
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("preview")}
          data-testid="main-tab-preview"
        >
          {t("preview_tab")}
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("history")}
          data-testid="main-tab-history"
        >
          {t("history_tab")}
        </button>
        {activeMainTab === "edit" ? (
          <button type="button" onClick={() => setSplitRatio(0.5)}>
            {t("reset_split")}
          </button>
        ) : null}
        <span style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ minHeight: 0, display: "grid", gap: 12, padding: 16 }}>
        <ConflictBanner />
        {activeMainTab === "edit" ? (
          <div style={{ display: "grid", gap: 12, gridTemplateRows: "minmax(280px, 1fr) auto" }}>
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
              <FragmentEditor />
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
              <FragmentPreview />
            </div>
            <FragmentList />
          </div>
        ) : null}
        {activeMainTab === "preview" ? <WorkspacePreview /> : null}
        {activeMainTab === "history" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <SnapshotTimeline />
            <SnapshotDiff />
          </div>
        ) : null}
      </div>
    </div>
  );
}
