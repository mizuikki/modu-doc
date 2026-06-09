import { useMemo } from "react";
import { summarizeForPreview } from "@/lib/markdownPreview";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveDocumentDraft } from "@/store/selectors";

export function DocumentPreview() {
  const doc = useAppStore(selectActiveDocument);
  const draft = useAppStore(selectActiveDocumentDraft);
  const content = draft ?? doc?.content ?? "";
  // The available preview helper strips markdown noise into a single readable
  // line. A full markdown-to-HTML renderer is out of scope for Phase 1; this
  // view shows the draft in a way that's safe and useful.
  const summary = useMemo(() => summarizeForPreview(content, { maxLength: 0 }), [content]);
  if (!doc) {
    return <div className="preview-empty">Select a document</div>;
  }
  return (
    <div className="preview-pane">
      <pre className="preview-summary">{summary}</pre>
    </div>
  );
}
