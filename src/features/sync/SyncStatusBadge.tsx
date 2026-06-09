import { useTranslation } from "react-i18next";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";
import {
  selectActiveDocumentProcessStatus,
  selectActiveDocumentStatusMessage,
} from "@/store/selectors";
import type { DocumentProcessStatus } from "@/store/types";

const statusColor: Record<DocumentProcessStatus, string> = {
  idle: "hsl(var(--muted-foreground))",
  editing: "hsl(38 92% 50%)",
  saving: "hsl(199 89% 48%)",
  writing: "hsl(219 84% 56%)",
  synced: "hsl(var(--primary))",
  error: "hsl(0 84% 60%)",
  conflicted: "hsl(8 84% 60%)",
};

/**
 * Shows the active document's process status. In the document-first model
 * the per-document status replaces the old workspace-level `compileStatus`.
 */
export function SyncStatusBadge() {
  const { t } = useTranslation();
  const status = useAppStore(selectActiveDocumentProcessStatus);
  const message = useAppStore(selectActiveDocumentStatusMessage);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 10px",
        borderRadius: 999,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        fontSize: 12,
        lineHeight: 1.2,
        color: "hsl(var(--foreground))",
      }}
      title={message ? tMaybe(t, message) : ""}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: statusColor[status] ?? statusColor.idle,
        }}
      />
      <span>
        {t("status")}: {tMaybe(t, status)}
      </span>
    </div>
  );
}
