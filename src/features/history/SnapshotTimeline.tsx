import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { createSnapshot, restoreSnapshot } from "@/lib/api/snapshots";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";

export function SnapshotTimeline() {
  const { t } = useTranslation();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const snapshots = useAppStore((state) => state.snapshots);
  const selectedSnapshotId = useAppStore((state) => state.selectedSnapshotId);
  const setSelectedSnapshot = useAppStore((state) => state.setSelectedSnapshot);

  const handleCreateSnapshot = async () => {
    if (!activeWorkspaceId) return;
    try {
      await createSnapshot({ workspaceId: activeWorkspaceId, label: null });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    try {
      await restoreSnapshot(snapshotId);
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
          disabled={!activeWorkspaceId}
          data-testid="history-create-snapshot"
        >
          {t("create_snapshot")}
        </button>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {snapshots.length === 0 ? (
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
