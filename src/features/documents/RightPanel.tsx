import { useAppStore } from "@/store/appStore";
import { selectActiveDocument } from "@/store/selectors";
import type { RightPanelTab } from "@/store/types";

const TABS: RightPanelTab[] = ["fragments", "recipes", "snapshots"];

export function RightPanel() {
  const collapsed = useAppStore((s) => s.ui.rightPanelCollapsed);
  const tab = useAppStore((s) => s.ui.rightPanelTab);
  const setTab = useAppStore((s) => s.setRightPanelTab);
  const toggle = useAppStore((s) => s.toggleRightPanelCollapsed);
  const activeDoc = useAppStore(selectActiveDocument);

  if (collapsed) {
    return (
      <aside className="right-panel-collapsed">
        <button
          type="button"
          onClick={toggle}
          className="right-panel-collapsed-trigger"
          aria-label="Open panel"
        >
          <span className="right-panel-collapsed-label">Open panel</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-panel">
      <header>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={t === tab ? "active" : ""}
            >
              {t}
            </button>
          ))}
        </div>
        <button type="button" onClick={toggle}>
          Close
        </button>
      </header>
      <div className="right-panel-content">
        {tab === "fragments" && <div className="panel-placeholder">Fragments library (TBD)</div>}
        {tab === "recipes" && <div className="panel-placeholder">Recipes (TBD)</div>}
        {tab === "snapshots" &&
          (activeDoc ? (
            <div className="panel-placeholder">Snapshots for {activeDoc.name} (TBD)</div>
          ) : (
            <div className="panel-placeholder">Select a document to see snapshots</div>
          ))}
      </div>
    </aside>
  );
}
