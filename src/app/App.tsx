import { useZenModeShortcut } from "@/app/hooks/useZenModeShortcut";
import { ColumnSplitter } from "@/components/layout/ColumnSplitter";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { KeyboardCheatsheet } from "@/features/help/KeyboardCheatsheet";
import { AssemblyBoard } from "@/features/recipes/AssemblyBoard";
import { MainPanel } from "@/features/workspaces/MainPanel";
import { WorkspaceSettingsDialog } from "@/features/workspaces/WorkspaceSettingsDialog";
import { useAppStore } from "@/store/appStore";

export function App() {
  const zenMode = useAppStore((state) => state.ui.zenMode);
  const sidebarWidth = useAppStore((state) => state.ui.sidebarWidth);
  const assemblyWidth = useAppStore((state) => state.ui.assemblyWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);
  const setAssemblyWidth = useAppStore((state) => state.setAssemblyWidth);
  const settingsDialogOpen = useAppStore((state) => state.ui.settingsDialogOpen);
  const setSettingsDialogOpen = useAppStore((state) => state.setSettingsDialogOpen);

  useZenModeShortcut();

  const gridTemplate = zenMode
    ? "minmax(0, 1fr)"
    : `${sidebarWidth}px 10px ${assemblyWidth}px 10px minmax(0, 1fr)`;

  return (
    <div className="app-shell">
      <Header />
      <main
        className="app-main"
        data-zen={zenMode ? "true" : "false"}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <aside className="panel" style={{ minWidth: 0 }}>
          <Sidebar />
        </aside>
        {!zenMode ? (
          <ColumnSplitter
            ariaLabel="Resize sidebar"
            testId="column-splitter-sidebar"
            currentPx={sidebarWidth}
            onResize={setSidebarWidth}
            minPx={176}
            maxPx={320}
          />
        ) : null}
        <section className="panel" style={{ minWidth: 0 }}>
          <AssemblyBoard />
        </section>
        {!zenMode ? (
          <ColumnSplitter
            ariaLabel="Resize assembly"
            testId="column-splitter-assembly"
            currentPx={assemblyWidth}
            onResize={setAssemblyWidth}
            minPx={360}
            maxPx={620}
          />
        ) : null}
        <section className="panel" style={{ minWidth: 0 }}>
          <MainPanel />
        </section>
      </main>
      <footer className="status-bar">
        <StatusBar />
      </footer>
      <KeyboardCheatsheet />
      <WorkspaceSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </div>
  );
}
