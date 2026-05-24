import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { AssemblyBoard } from "@/features/recipes/AssemblyBoard";
import { SyncStatusBadge } from "@/features/sync/SyncStatusBadge";
import { MainPanel } from "@/features/workspaces/MainPanel";

export function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <aside className="panel">
          <Sidebar />
        </aside>
        <section className="panel">
          <AssemblyBoard />
        </section>
        <section className="panel">
          <MainPanel />
        </section>
      </main>
      <footer className="status-bar">
        <SyncStatusBadge />
      </footer>
    </div>
  );
}
