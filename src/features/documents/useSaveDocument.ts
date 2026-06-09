import { useCallback } from "react";
import { mapDocument } from "@/app/workspaceMappers";
import { updateDocument } from "@/lib/api/documents";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveDocumentDraft } from "@/store/selectors";

/**
 * Provides `saveActiveDocument`, which persists the active document's current
 * draft to the backend via `update_document`, then clears the draft and marks
 * the document as `synced`.
 *
 * Returns `null` if there is no active document, in which case the caller
 * decides what to do (toast, no-op, etc.).
 */
export function useSaveDocument() {
  const saveActiveDocument = useCallback(async () => {
    const state = useAppStore.getState();
    const doc = selectActiveDocument(state);
    if (!doc) return null;
    const draft = selectActiveDocumentDraft(state) ?? doc.content;
    state.setDocumentProcessStatus(doc.id, "saving");
    try {
      const updated = await updateDocument({ id: doc.id, content: draft });
      state.patchDocument(doc.id, mapDocument(updated));
      state.clearDocumentDraft(doc.id);
      state.setDocumentProcessStatus(doc.id, "synced");
      state.setDocumentStatusMessage(doc.id, "Saved");
      return updated;
    } catch (err) {
      state.setDocumentProcessStatus(doc.id, "error");
      state.setDocumentStatusMessage(doc.id, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  return { saveActiveDocument };
}
