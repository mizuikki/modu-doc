import { SnapshotDiff } from "@/features/history/SnapshotDiff";
import { SnapshotTimeline } from "@/features/history/SnapshotTimeline";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument } from "@/store/selectors";
import { DocumentHeader } from "./DocumentHeader";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentTargetBar } from "./DocumentTargetBar";
import { EditorPane } from "./EditorPane";

export function DocumentEditor() {
  const doc = useAppStore(selectActiveDocument);
  const centerMode = useAppStore((s) => s.ui.centerMode);
  if (!doc) {
    return <div className="editor-empty">Select a document from the sidebar</div>;
  }
  return (
    <div className="document-editor">
      <DocumentHeader />
      <DocumentTargetBar />
      {centerMode === "edit" && <EditorPane />}
      {centerMode === "preview" && <DocumentPreview />}
      {centerMode === "split" && (
        <div className="split-view">
          <EditorPane />
          <DocumentPreview />
        </div>
      )}
      {centerMode === "history" && (
        <div className="history-view">
          <SnapshotTimeline />
          <SnapshotDiff />
        </div>
      )}
    </div>
  );
}
