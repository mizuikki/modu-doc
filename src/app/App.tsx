import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useProjectBootstrap } from "@/app/hooks/useProjectBootstrap";
import { useProjectStatusEvents } from "@/app/hooks/useProjectStatusEvents";
import { useZenModeShortcut } from "@/app/hooks/useZenModeShortcut";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { ColumnSplitter } from "@/components/layout/ColumnSplitter";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { useToast } from "@/components/toast/ToastProvider";
import { DocumentEditor } from "@/features/documents/DocumentEditor";
import { RightPanel } from "@/features/documents/RightPanel";
import { KeyboardCheatsheet } from "@/features/help/KeyboardCheatsheet";
import { ProjectSettingsDialog } from "@/features/projects/ProjectSettingsDialog";
import { normalizeAppError } from "@/lib/appError";
import {
  initialUI,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  useAppStore,
} from "@/store/appStore";

function resolvePanelWidth(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function App() {
  const { t } = useTranslation();
  const { status, error, createAndOpen } = useProjectBootstrap();
  useProjectStatusEvents();
  useZenModeShortcut();

  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const sidebarWidth = resolvePanelWidth(
    useAppStore((s) => s.ui.sidebarWidth),
    initialUI.sidebarWidth,
    SIDEBAR_WIDTH_MIN,
    SIDEBAR_WIDTH_MAX,
  );
  const rightPanelWidth = resolvePanelWidth(
    useAppStore((s) => s.ui.rightPanelWidth),
    initialUI.rightPanelWidth,
    RIGHT_PANEL_WIDTH_MIN,
    RIGHT_PANEL_WIDTH_MAX,
  );
  const rightPanelCollapsed = useAppStore((s) => s.ui.rightPanelCollapsed);
  const zenMode = useAppStore((s) => s.ui.zenMode);
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
  const settingsDialogOpen = useAppStore((s) => s.ui.settingsDialogOpen);
  const setSettingsDialogOpen = useAppStore((s) => s.setSettingsDialogOpen);
  const rightPanelColumnWidth = rightPanelCollapsed ? 48 : rightPanelWidth;
  const shellStyle = {
    "--app-sidebar-width": `${sidebarWidth}px`,
    "--app-right-panel-width": `${rightPanelColumnWidth}px`,
    display: "grid",
    gridTemplateColumns: zenMode
      ? "minmax(0, 1fr)"
      : `${sidebarWidth}px 10px minmax(0, 1fr) ${rightPanelColumnWidth}px`,
  } as CSSProperties;

  if (status === "loading") {
    return <div className="app-loading">Loading…</div>;
  }
  if (status === "error") {
    return <div className="app-error">Error: {error}</div>;
  }
  if (status === "ready" && !activeProjectId) {
    return <WelcomeScreen onCreate={createAndOpen} />;
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main" data-zen={zenMode ? "true" : "false"} style={shellStyle}>
        <aside className="app-sidebar">
          <Sidebar />
        </aside>
        {!zenMode ? (
          <ColumnSplitter
            ariaLabel={t("resize_sidebar")}
            currentPx={sidebarWidth}
            minPx={SIDEBAR_WIDTH_MIN}
            maxPx={SIDEBAR_WIDTH_MAX}
            onResize={setSidebarWidth}
            className="sidebar-resizer"
            testId="sidebar-resizer"
          />
        ) : null}
        <section className="app-center">
          <DocumentEditor />
        </section>
        <RightPanel />
      </main>
      <footer className="status-bar">
        <StatusBar />
      </footer>
      <KeyboardCheatsheet />
      <ProjectSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </div>
  );
}

function WelcomeScreen({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await dialog.prompt({
      title: t("project_name_prompt"),
      defaultValue: "Untitled Project",
    });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      await onCreate(name);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  return (
    <div
      className="welcome-screen"
      data-testid="welcome-screen"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        height: "100%",
        padding: "var(--space-8)",
        textAlign: "center",
      }}
    >
      <h1
        data-testid="welcome-title"
        style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: -0.02,
        }}
      >
        ModuDoc
      </h1>
      <p
        data-testid="welcome-subtitle"
        style={{
          margin: 0,
          color: "hsl(var(--muted-foreground))",
          fontSize: 14,
        }}
      >
        Document-first markdown editor.
      </p>
      <button
        type="button"
        onClick={() => void handleCreate()}
        data-testid="welcome-create-project"
        style={{
          marginTop: "var(--space-4)",
          padding: "10px 18px",
          borderRadius: 999,
          border: "1px solid hsl(var(--primary))",
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 120ms, border-color 120ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            "color-mix(in srgb, hsl(var(--primary)) 88%, hsl(0 0% 0%))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "hsl(var(--primary))";
        }}
      >
        Create your first project
      </button>
    </div>
  );
}
