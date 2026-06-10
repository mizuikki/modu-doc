import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { mapDocument } from "@/app/projectMappers";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { createSnapshot, restoreSnapshot } from "@/lib/api/snapshots";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocumentSnapshots } from "@/store/selectors";

/**
 * Snapshot timeline is per-document in the new model. It reads snapshots
 * from `selectActiveDocumentSnapshots` and operates on the active document
 * id when creating or restoring a snapshot.
 */
export function SnapshotTimeline() {
  const { t } = useTranslation();
  const toast = useToast();
  const activeDocumentId = useAppStore((state) => state.activeDocumentId);
  const snapshots = useAppStore(useShallow(selectActiveDocumentSnapshots));
  const selectedSnapshotId = useAppStore((state) => state.selectedSnapshotId);
  const setSelectedSnapshot = useAppStore((state) => state.setSelectedSnapshot);
  const patchDocument = useAppStore((state) => state.patchDocument);
  const clearDocumentDraft = useAppStore((state) => state.clearDocumentDraft);

  const handleCreateSnapshot = async () => {
    if (!activeDocumentId) return;
    try {
      await createSnapshot({ documentId: activeDocumentId, label: null });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!activeDocumentId) return;
    try {
      const updated = await restoreSnapshot({
        documentId: activeDocumentId,
        snapshotId,
        mode: "overwrite",
      });
      patchDocument(updated.id, mapDocument(updated));
      clearDocumentDraft(updated.id);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  return (
    <div style={{ padding: 16, borderTop: "1px solid hsl(var(--border))" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <h3>{t("history")}</h3>
        <button
          type="button"
          onClick={handleCreateSnapshot}
          disabled={!activeDocumentId}
          data-testid="history-create-snapshot"
          aria-label={t("create_snapshot")}
          title={t("create_snapshot")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            cursor: activeDocumentId ? "pointer" : "not-allowed",
            opacity: activeDocumentId ? 1 : 0.5,
            fontSize: 12,
            color: "hsl(var(--foreground))",
          }}
        >
          <Plus aria-hidden size={12} strokeWidth={2} />
          {t("create_snapshot")}
        </button>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {!activeDocumentId ? (
          <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
            {t("no_snapshots_yet")}
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
            {t("no_snapshots_yet")}
          </div>
        ) : (
          snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              data-testid={`history-snapshot-${snapshot.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                border:
                  snapshot.id === selectedSnapshotId
                    ? "1px solid hsl(var(--primary))"
                    : "1px solid hsl(var(--border))",
                borderRadius: 12,
                padding: 10,
                background:
                  snapshot.id === selectedSnapshotId ? "hsl(var(--accent))" : "transparent",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedSnapshot(snapshot.id)}
                data-testid={`history-snapshot-select-${snapshot.id}`}
                style={{
                  flex: 1,
                  textAlign: "left",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  color: "inherit",
                }}
              >
                <div>{snapshot.label ? tMaybe(t, snapshot.label) : t("create_snapshot")}</div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {snapshot.createdAt}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRestoreSnapshot(snapshot.id);
                }}
                data-testid={`history-snapshot-restore-${snapshot.id}`}
              >
                {t("restore")}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
