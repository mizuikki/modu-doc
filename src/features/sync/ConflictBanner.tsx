import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import {
  type ConflictPolicy,
  resolveDocumentConflict,
  writeDocumentToFile,
} from "@/lib/api/documents";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import type { DocumentSummary } from "@/store/types";

type ConflictBannerProps = {
  document?: DocumentSummary | null;
};

const POLICIES: Array<{ value: ConflictPolicy; labelKey: string; testId: string }> = [
  {
    value: "import_external",
    labelKey: "import_as_fragment",
    testId: "conflict-import-as-fragment",
  },
  {
    value: "overwrite_external",
    labelKey: "overwrite_target",
    testId: "conflict-overwrite-target",
  },
  {
    value: "backup_and_overwrite",
    labelKey: "backup_then_overwrite",
    testId: "conflict-backup-then-overwrite",
  },
  { value: "cancel", labelKey: "cancel", testId: "conflict-cancel" },
];

/**
 * Document-first conflict banner. Reads the conflict signal from
 * `document.fileStatus === "conflicted"` and resolves it with the new
 * `resolveDocumentConflict` API. Falls back to the active document if no
 * `document` prop is provided (e.g. when used as a top-level indicator).
 */
export function ConflictBanner({ document: documentProp }: ConflictBannerProps = {}) {
  const { t } = useTranslation();
  const toast = useToast();
  const activeDocument = useAppStore(
    (state) => state.documents.find((doc) => doc.id === state.activeDocumentId) ?? null,
  );
  const document = documentProp ?? activeDocument;
  const setProcessStatus = useAppStore((state) => state.setDocumentProcessStatus);
  const setStatusMessage = useAppStore((state) => state.setDocumentStatusMessage);
  const [isResolving, setIsResolving] = useState(false);

  if (!document) return null;
  if (document.fileStatus !== "conflicted") return null;

  const handleResolve = async (policy: ConflictPolicy) => {
    if (policy === "cancel") {
      setStatusMessage(document.id, null);
      return;
    }
    setIsResolving(true);
    setStatusMessage(document.id, null);
    setProcessStatus(document.id, "writing");
    try {
      if (policy === "import_external") {
        // First pull the latest file contents into the document, then write
        // the document back to the target. The backend's `import_external`
        // policy folds the external content into the document; we then
        // ensure a write so the file matches.
        await resolveDocumentConflict({ id: document.id, policy: "import_external" });
      } else {
        await resolveDocumentConflict({ id: document.id, policy });
        if (policy === "overwrite_external" || policy === "backup_and_overwrite") {
          await writeDocumentToFile(document.id);
        }
      }
      setProcessStatus(document.id, "synced");
      setStatusMessage(document.id, "conflict_resolved");
    } catch (error) {
      setProcessStatus(document.id, "error");
      setStatusMessage(document.id, normalizeAppError(error));
      toast.error(normalizeAppError(error), t("action_failed"));
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div
      data-testid="conflict-banner"
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid hsl(8 84% 60%)",
        background: "hsl(8 100% 97%)",
        color: "hsl(8 50% 25%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>{t("external_conflict")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {POLICIES.map((policy) => (
          <button
            key={policy.value}
            type="button"
            onClick={() => void handleResolve(policy.value)}
            disabled={isResolving}
            data-testid={policy.testId}
          >
            {t(policy.labelKey as never)}
          </button>
        ))}
      </div>
    </div>
  );
}
