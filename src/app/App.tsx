import { type CSSProperties, useEffect } from "react";
import { useWorkspaceBootstrap } from "@/app/hooks/useWorkspaceBootstrap";
import { useWorkspaceStatusEvents } from "@/app/hooks/useWorkspaceStatusEvents";
import { useZenModeShortcut } from "@/app/hooks/useZenModeShortcut";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { DocumentEditor } from "@/features/documents/DocumentEditor";
import { RightPanel } from "@/features/documents/RightPanel";
import { KeyboardCheatsheet } from "@/features/help/KeyboardCheatsheet";
import { WorkspaceSettingsDialog } from "@/features/workspaces/WorkspaceSettingsDialog";
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
  const { status, error, createAndOpen } = useWorkspaceBootstrap();
  useWorkspaceStatusEvents();
  useZenModeShortcut();

  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
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
  const settingsDialogOpen = useAppStore((s) => s.ui.settingsDialogOpen);
  const setSettingsDialogOpen = useAppStore((s) => s.setSettingsDialogOpen);
  const rightPanelColumnWidth = rightPanelCollapsed ? 48 : rightPanelWidth;
  const shellStyle = {
    "--app-sidebar-width": `${sidebarWidth}px`,
    "--app-right-panel-width": `${rightPanelColumnWidth}px`,
    display: "grid",
    gridTemplateColumns: zenMode
      ? "minmax(0, 1fr)"
      : `${sidebarWidth}px minmax(0, 1fr) ${rightPanelColumnWidth}px`,
  } as CSSProperties;

  if (status === "loading") {
    return <div className="app-loading">Loading…</div>;
  }
  if (status === "error") {
    return <div className="app-error">Error: {error}</div>;
  }
  if (status === "ready" && !activeWorkspaceId) {
    return <WelcomeScreen onCreate={createAndOpen} />;
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main" data-zen={zenMode ? "true" : "false"} style={shellStyle}>
        <aside className="app-sidebar">
          <Sidebar />
        </aside>
        <section className="app-center">
          <DocumentEditor />
        </section>
        <RightPanel />
      </main>
      <footer className="status-bar">
        <StatusBar />
      </footer>
      <KeyboardCheatsheet />
      <WorkspaceSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </div>
  );
}

function WelcomeScreen({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  useEffect(() => {
    // No-op effect placeholder; keeps the import surface stable.
  }, []);
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
        onClick={() => void onCreate("Untitled")}
        data-testid="welcome-create-workspace"
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
        Create your first workspace
      </button>
    </div>
  );
}
