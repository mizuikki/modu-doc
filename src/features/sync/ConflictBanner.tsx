import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { writeTargetFile } from "@/lib/api/sync";
import { updateWorkspace } from "@/lib/api/workspaces";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export function ConflictBanner() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const compileStatus = useAppStore((state) => state.compileStatus);
  const workspaceStatusMessage = useAppStore((state) => state.workspaceStatusMessage);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const isConflict =
    compileStatus === "conflicted" || workspaceStatusMessage === "external_conflict";
  const isTargetIssue =
    workspaceStatusMessage === "target_not_writable" ||
    workspaceStatusMessage === "target_missing" ||
    workspaceStatusMessage === "invalid_target_path";

  const handleResolve = async (
    policy: "import_as_fragment" | "overwrite_target" | "backup_then_overwrite",
  ) => {
    if (!activeWorkspaceId) return;
    setWorkspaceStatusMessage(null);
    if (policy === "overwrite_target") {
      const ok = await dialog.confirm({
        title: t("overwrite_target"),
        description: t("overwrite_confirm"),
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await writeTargetFile({ workspaceId: activeWorkspaceId, conflictPolicy: policy });
      if (policy === "import_as_fragment") {
        setWorkspaceStatusMessage("conflict_imported_as_fragment");
        setCompileStatus("conflicted");
      }
    } catch (error) {
      setWorkspaceStatusMessage(normalizeAppError(error));
      setCompileStatus("error");
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleChooseTarget = async () => {
    if (!activeWorkspaceId) return;
    try {
      const targetPath = await save({
        defaultPath: `${activeWorkspace?.name ?? "workspace"}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!targetPath) return;
      await updateWorkspace({
        id: activeWorkspaceId,
        name: null,
        targetPath,
        clearTargetPath: false,
      });
    } catch (error) {
      setWorkspaceStatusMessage(normalizeAppError(error));
      setCompileStatus("error");
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  if (!isConflict && !isTargetIssue) {
    return null;
  }

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
      <div>
        {workspaceStatusMessage ? tMaybe(t, workspaceStatusMessage) : t("external_conflict")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {isConflict ? (
          <>
            <button
              type="button"
              onClick={() => handleResolve("import_as_fragment")}
              disabled={!activeWorkspaceId}
              data-testid="conflict-import-as-fragment"
            >
              {t("import_as_fragment")}
            </button>
            <button
              type="button"
              onClick={() => handleResolve("overwrite_target")}
              disabled={!activeWorkspaceId}
              data-testid="conflict-overwrite-target"
            >
              {t("overwrite_target")}
            </button>
            <button
              type="button"
              onClick={() => handleResolve("backup_then_overwrite")}
              disabled={!activeWorkspaceId}
              data-testid="conflict-backup-then-overwrite"
            >
              {t("backup_then_overwrite")}
            </button>
          </>
        ) : null}
        {isTargetIssue ? (
          <button
            type="button"
            onClick={handleChooseTarget}
            disabled={!activeWorkspaceId}
            data-testid="conflict-choose-target"
          >
            {t("choose_target")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
