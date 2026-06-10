import { useEffect, useRef, useState } from "react";
import { mapDocument } from "@/app/projectMappers";
import { updateDocument } from "@/lib/api/documents";
import { normalizeAppError } from "@/lib/appError";
import { logDebugPerf } from "@/lib/debugPerf";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveDocumentDraft } from "@/store/selectors";

export function EditorPane() {
  const draft = useAppStore(selectActiveDocumentDraft);
  const doc = useAppStore(selectActiveDocument);
  const updateDraft = useAppStore((s) => s.updateDocumentDraft);
  const flushDraft = useAppStore((s) => s.flushDocumentDraft);
  const clearDraft = useAppStore((s) => s.clearDocumentDraft);
  const patchDocument = useAppStore((s) => s.patchDocument);
  const setProcessStatus = useAppStore((s) => s.setDocumentProcessStatus);
  const setStatusMessage = useAppStore((s) => s.setDocumentStatusMessage);
  const localValue = draft ?? doc?.content ?? "";
  const [internal, setInternal] = useState(localValue);
  const loggedDocumentId = useRef<string | null>(null);

  useEffect(() => {
    setInternal(localValue);
  }, [localValue]);

  useEffect(() => {
    if (!doc) {
      loggedDocumentId.current = null;
      return;
    }
    if (loggedDocumentId.current === doc.id) {
      return;
    }
    loggedDocumentId.current = doc.id;
    const contentBytes = localValue.length;
    void logDebugPerf("document editor: document bound", {
      documentId: doc.id,
      contentBytes,
    });
    requestAnimationFrame(() => {
      void logDebugPerf("document editor: editor ready", {
        documentId: doc.id,
        contentBytes,
      });
    });
  }, [doc, localValue.length]);

  if (!doc) {
    return <div className="editor-pane-empty">Select a document</div>;
  }

  const persistDraft = async () => {
    const nextContent = useAppStore.getState().documentDrafts[doc.id];
    if (nextContent === undefined) {
      return;
    }

    flushDraft(doc.id);
    setProcessStatus(doc.id, "saving");
    setStatusMessage(doc.id, null);

    try {
      const updated = await updateDocument({ id: doc.id, content: nextContent });
      patchDocument(doc.id, mapDocument(updated));
      clearDraft(doc.id);
      setProcessStatus(doc.id, "idle");
    } catch (error) {
      setProcessStatus(doc.id, "error");
      setStatusMessage(doc.id, normalizeAppError(error));
    }
  };

  return (
    <textarea
      className="editor-pane-textarea"
      data-testid="editor-pane-textarea"
      data-document-id={doc.id}
      value={internal}
      onChange={(e) => {
        const nextValue = e.target.value;
        setInternal(nextValue);
        updateDraft(doc.id, nextValue);
        void logDebugPerf("document editor: content updated", {
          documentId: doc.id,
          contentBytes: nextValue.length,
        });
      }}
      onBlur={() => {
        void persistDraft();
      }}
      spellCheck={false}
    />
  );
}
