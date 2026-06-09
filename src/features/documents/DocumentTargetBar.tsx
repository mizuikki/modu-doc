import { useState } from "react";
import { mapDocument } from "@/app/workspaceMappers";
import {
  type ConflictPolicy,
  resolveDocumentConflict,
  writeDocumentToFile,
} from "@/lib/api/documents";
import { normalizeApiErrorCode } from "@/lib/api/errors";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument } from "@/store/selectors";

const POLICIES: Array<{ value: ConflictPolicy; label: string }> = [
  { value: "import_external", label: "Import external" },
  { value: "overwrite_external", label: "Overwrite" },
  { value: "backup_and_overwrite", label: "Backup & overwrite" },
  { value: "cancel", label: "Cancel" },
];

export function DocumentTargetBar() {
  const doc = useAppStore(selectActiveDocument);
  const setProcessStatus = useAppStore((s) => s.setDocumentProcessStatus);
  const setMessage = useAppStore((s) => s.setDocumentStatusMessage);
  const patch = useAppStore((s) => s.patchDocument);
  const [conflict, setConflict] = useState(false);

  if (!doc) return null;

  const write = async () => {
    setProcessStatus(doc.id, "writing");
    setMessage(doc.id, null);
    try {
      const updated = await writeDocumentToFile(doc.id);
      patch(doc.id, mapDocument(updated));
      setProcessStatus(doc.id, "synced");
      setMessage(doc.id, "Saved to file");
      setConflict(false);
    } catch (err) {
      const code = normalizeApiErrorCode(err);
      if (code === "external_conflict") {
        setConflict(true);
        setProcessStatus(doc.id, "conflicted");
        setMessage(doc.id, "File changed on disk");
      } else {
        setProcessStatus(doc.id, "error");
        setMessage(doc.id, code);
      }
    }
  };

  const resolve = async (policy: ConflictPolicy) => {
    setProcessStatus(doc.id, "writing");
    try {
      const updated = await resolveDocumentConflict({ id: doc.id, policy });
      patch(doc.id, mapDocument(updated));
      setProcessStatus(doc.id, "synced");
      setMessage(doc.id, "Conflict resolved");
      setConflict(false);
    } catch (err) {
      setProcessStatus(doc.id, "error");
      setMessage(doc.id, normalizeApiErrorCode(err));
    }
  };

  return (
    <div
      className={`target-bar file-status-${doc.fileStatus}`}
      data-testid="target-bar"
      data-file-status={doc.fileStatus}
    >
      <span className="target-bar-path" data-testid="target-bar-path">
        {doc.targetPath ?? "No target file"}
      </span>
      <span className="target-bar-status" data-testid="target-bar-status">
        {doc.fileStatus}
      </span>
      <button
        type="button"
        onClick={write}
        disabled={doc.targetPath === null}
        data-testid="target-bar-write"
      >
        Write to file
      </button>
      {conflict && (
        <div className="target-bar-conflict" role="alert" data-testid="target-bar-conflict">
          <span>External change detected. Choose how to resolve:</span>
          {POLICIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => void resolve(p.value)}
              data-testid={`target-bar-resolve-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
