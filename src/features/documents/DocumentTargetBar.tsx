import { useState } from "react";
import { useTranslation } from "react-i18next";
import { mapDocument } from "@/app/projectMappers";
import { tMaybe } from "@/i18n/tMaybe";
import { type ConflictPolicy, resolveDocumentConflict } from "@/lib/api/documents";
import { normalizeApiErrorCode } from "@/lib/api/errors";
import { useAppStore } from "@/store/appStore";
import {
  selectActiveDocument,
  selectActiveDocumentDraft,
  selectActiveDocumentProcessStatus,
} from "@/store/selectors";
import type { DocumentProcessStatus, DocumentSaveState } from "@/store/types";
import { useSaveDocument } from "./useSaveDocument";

const POLICIES: Array<{ value: ConflictPolicy; label: string }> = [
  { value: "import_external", label: "import_external" },
  { value: "overwrite_external", label: "overwrite_external" },
  { value: "backup_and_overwrite", label: "backup_and_overwrite" },
  { value: "cancel", label: "cancel" },
];

export function DocumentTargetBar() {
  const { t } = useTranslation();
  const doc = useAppStore(selectActiveDocument);
  const draft = useAppStore(selectActiveDocumentDraft);
  const processStatus = useAppStore(selectActiveDocumentProcessStatus);
  const setProcessStatus = useAppStore((s) => s.setDocumentProcessStatus);
  const setMessage = useAppStore((s) => s.setDocumentStatusMessage);
  const patch = useAppStore((s) => s.patchDocument);
  const { saveActiveDocument } = useSaveDocument();
  const [conflict, setConflict] = useState(false);

  if (!doc) return null;

  const hasLocalChanges = draft !== null && draft !== doc.content;
  const visibleSaveState: DocumentSaveState =
    hasLocalChanges && doc.targetPath ? "unsaved" : doc.saveState;
  const pathLabel = doc.targetPath ?? t("no_file_selected");
  const hasConflict = conflict || doc.saveState === "conflict";

  const saveToFile = async (saveAs = false) => {
    try {
      await saveActiveDocument({ saveAs });
      setConflict(false);
    } catch (err) {
      const code = normalizeApiErrorCode(err);
      if (code === "external_conflict") {
        setConflict(true);
        setProcessStatus(doc.id, "conflict");
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
      className={`target-bar save-state-${visibleSaveState}`}
      data-testid="target-bar"
      data-save-state={visibleSaveState}
    >
      <span className="target-bar-path" data-testid="target-bar-path">
        {pathLabel}
      </span>
      <span className="target-bar-status" data-testid="target-bar-status">
        {targetStatusLabel(t, visibleSaveState, processStatus)}
      </span>
      <button type="button" onClick={() => void saveToFile(false)} data-testid="target-bar-write">
        {t("save_to_file")}
      </button>
      {doc.targetPath ? (
        <button
          type="button"
          onClick={() => void saveToFile(true)}
          data-testid="target-bar-save-as"
        >
          {t("save_as")}
        </button>
      ) : null}
      {hasConflict && (
        <div className="target-bar-conflict" role="alert" data-testid="target-bar-conflict">
          <span>{t("external_change_detected")}</span>
          {POLICIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => void resolve(p.value)}
              data-testid={`target-bar-resolve-${p.value}`}
            >
              {tMaybe(t, p.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function targetStatusLabel(
  t: ReturnType<typeof useTranslation>["t"],
  saveState: DocumentSaveState,
  processStatus: DocumentProcessStatus,
) {
  if (processStatus === "saving") return t("saving");
  if (processStatus === "writing") return t("saving_to_file");
  if (processStatus === "editing" && saveState === "unsaved") return t("unsaved_changes");
  switch (saveState) {
    case "draft":
      return t("draft");
    case "unsaved":
      return t("unsaved");
    case "saved":
      return t("saved");
    case "conflict":
      return t("file_changed_externally");
    case "error":
      return t("save_failed");
  }
}
