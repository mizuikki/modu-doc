import { save } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import { mapDocument } from "@/app/projectMappers";
import { updateDocument, writeDocumentToFile } from "@/lib/api/documents";
import { normalizeApiErrorCode } from "@/lib/api/errors";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveDocumentDraft } from "@/store/selectors";
import type { DocumentSummary } from "@/store/types";

/**
 * Provides the document-first save flow used by both Ctrl/Cmd+S and the target
 * bar: persist the editor draft, bind a target path if needed, then write the
 * Markdown content to the selected file.
 */
export function useSaveDocument() {
  const saveActiveDocument = useCallback(async (options?: { saveAs?: boolean }) => {
    const state = useAppStore.getState();
    const doc = selectActiveDocument(state);
    if (!doc) return null;

    state.setDocumentProcessStatus(doc.id, "saving");
    state.setDocumentStatusMessage(doc.id, null);

    try {
      const draft = selectActiveDocumentDraft(state) ?? doc.content;
      let persisted = mapDocument(await updateDocument({ id: doc.id, content: draft }));
      state.patchDocument(doc.id, persisted);
      state.clearDocumentDraft(doc.id);

      if (options?.saveAs || !persisted.targetPath) {
        const selectedPath = await chooseSavePath(persisted);
        if (!selectedPath) {
          state.setDocumentProcessStatus(doc.id, "idle");
          state.setDocumentStatusMessage(doc.id, "Save canceled");
          return null;
        }
        persisted = mapDocument(
          await updateDocument({
            id: doc.id,
            content: persisted.content,
            targetPath: selectedPath,
          }),
        );
        state.patchDocument(doc.id, persisted);
      }

      state.setDocumentProcessStatus(doc.id, "writing");
      const written = await writeDocumentToFile(doc.id);
      state.patchDocument(doc.id, mapDocument(written));
      state.setDocumentProcessStatus(doc.id, "synced");
      state.setDocumentStatusMessage(doc.id, "Saved to file");
      return written;
    } catch (err) {
      const code = normalizeApiErrorCode(err);
      state.setDocumentProcessStatus(doc.id, "error");
      state.setDocumentStatusMessage(doc.id, code);
      throw err;
    }
  }, []);

  return { saveActiveDocument };
}

function ensureMarkdownName(name: string): string {
  const trimmed = name.trim() || "Untitled.md";
  return /\.(md|markdown)$/iu.test(trimmed) ? trimmed : `${trimmed}.md`;
}

async function chooseSavePath(document: DocumentSummary): Promise<string | null> {
  return await save({
    defaultPath: document.targetPath ?? ensureMarkdownName(document.name),
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
}
