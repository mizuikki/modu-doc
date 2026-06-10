import { useShallow } from "zustand/react/shallow";
import { mapDocument } from "@/app/projectMappers";
import { createDocument, softDeleteDocument, updateDocument } from "@/lib/api/documents";
import { useAppStore } from "@/store/appStore";
import { selectVisibleDocuments } from "@/store/selectors";

export function DocumentList() {
  const documents = useAppStore(useShallow(selectVisibleDocuments));
  const activeId = useAppStore((s) => s.activeDocumentId);
  const setActive = useAppStore((s) => s.setActiveDocument);
  const patch = useAppStore((s) => s.patchDocument);
  const projectId = useAppStore((s) => s.activeProjectId);

  const newDocument = async () => {
    if (!projectId) return;
    const name = window.prompt("Document name", "Untitled.md") ?? "Untitled.md";
    try {
      const created = await createDocument({ projectId, name });
      patch(created.id, mapDocument(created));
      setActive(created.id);
    } catch (err) {
      window.alert(
        `Failed to create document: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const setTarget = async (id: string) => {
    const path = window.prompt("Target absolute path", "");
    if (!path) return;
    try {
      const updated = await updateDocument({ id, targetPath: path });
      patch(id, mapDocument(updated));
    } catch (err) {
      window.alert(`Failed to set target: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await softDeleteDocument(id);
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="document-list" data-testid="document-list">
      <header>
        <h3 data-testid="document-list-title">Documents</h3>
        <button type="button" onClick={() => void newDocument()} data-testid="document-list-new">
          + New
        </button>
      </header>
      <ul>
        {documents.map((d) => (
          <li
            key={d.id}
            data-testid={`document-list-item-${d.id}`}
            data-active={d.id === activeId ? "true" : "false"}
            className={d.id === activeId ? "active" : ""}
          >
            <button type="button" onClick={() => setActive(d.id)}>
              {d.name}
            </button>
            <span
              data-testid={`document-list-item-status-${d.id}`}
              className={`status-pill status-${d.saveState}`}
            >
              {d.saveState}
            </span>
            <div className="row-actions">
              <button
                type="button"
                onClick={() => void setTarget(d.id)}
                data-testid={`document-list-item-set-target-${d.id}`}
              >
                Set target
              </button>
              <button
                type="button"
                onClick={() => void remove(d.id)}
                data-testid={`document-list-item-delete-${d.id}`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
