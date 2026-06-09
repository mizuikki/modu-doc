import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveDocumentDraft } from "@/store/selectors";

export function EditorPane() {
  const draft = useAppStore(selectActiveDocumentDraft);
  const doc = useAppStore(selectActiveDocument);
  const updateDraft = useAppStore((s) => s.updateDocumentDraft);
  const flushDraft = useAppStore((s) => s.flushDocumentDraft);
  const localValue = draft ?? doc?.content ?? "";
  const [internal, setInternal] = useState(localValue);

  useEffect(() => {
    setInternal(localValue);
  }, [localValue]);

  if (!doc) {
    return <div className="editor-pane-empty">Select a document</div>;
  }
  return (
    <textarea
      className="editor-pane-textarea"
      data-testid="editor-pane-textarea"
      data-document-id={doc.id}
      value={internal}
      onChange={(e) => {
        setInternal(e.target.value);
        updateDraft(doc.id, e.target.value);
      }}
      onBlur={() => flushDraft(doc.id)}
      spellCheck={false}
    />
  );
}
