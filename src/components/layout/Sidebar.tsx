import { open, save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { WorkspaceSelect } from "@/features/workspaces/WorkspaceSelect";
import { WorkspaceSettingsDialog } from "@/features/workspaces/WorkspaceSettingsDialog";
import { tMaybe } from "@/i18n/tMaybe";
import { exportWorkspace, importMarkdownFile, importWorkspacePackage } from "@/lib/api/packages";
import { createWorkspace } from "@/lib/api/workspaces";
import { normalizeAppError } from "@/lib/appError";
import { scheduleWorkspaceSync } from "@/lib/syncScheduler";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export function Sidebar() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const setActiveMainTab = useAppStore((state) => state.setActiveMainTab);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);
  const activeWorkspace = useAppStore(selectActiveWorkspace);

  const handleCreateWorkspace = async () => {
    const result = await dialog.prompt({ title: t("workspace_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      const workspace = await createWorkspace({ name, targetPath: null });
      setActiveWorkspace(workspace.id);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleImportMarkdown = async () => {
    if (!activeWorkspaceId) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (typeof selected !== "string" || !selected) return;
      await importMarkdownFile({
        workspaceId: activeWorkspaceId,
        path: selected,
        mode: "import_as_fragment",
      });
      if (activeWorkspace?.targetPath) {
        scheduleWorkspaceSync({
          workspaceId: activeWorkspaceId,
          setWorkspaceStatusMessage,
          setCompileStatus,
        });
      }
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleExportPackage = async () => {
    if (!activeWorkspaceId) return;
    try {
      const targetPath = await save({
        defaultPath: `${activeWorkspace?.name ?? "workspace"}.agentpack`,
        filters: [{ name: "ModuDoc package", extensions: ["agentpack"] }],
      });
      if (!targetPath) return;
      await exportWorkspace({ workspaceId: activeWorkspaceId, path: targetPath });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleImportPackage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "ModuDoc package", extensions: ["agentpack"] }],
      });
      if (typeof selected !== "string" || !selected) return;
      const workspaceId = await importWorkspacePackage(selected);
      setActiveWorkspace(workspaceId);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <WorkspaceSelect />
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <button type="button" onClick={handleCreateWorkspace} data-testid="sidebar-new-workspace">
          {t("new_workspace")}
        </button>
        <WorkspaceSettingsDialog />
        <button
          type="button"
          onClick={handleImportMarkdown}
          disabled={!activeWorkspaceId}
          data-testid="sidebar-import-markdown"
        >
          {t("import_markdown")}
        </button>
        <button
          type="button"
          onClick={handleExportPackage}
          disabled={!activeWorkspaceId}
          data-testid="sidebar-export-package"
        >
          {t("export_package")}
        </button>
        <button type="button" onClick={handleImportPackage} data-testid="sidebar-import-package">
          {t("import_package")}
        </button>
      </div>
      <nav style={{ marginTop: 16, display: "grid", gap: 8 }}>
        <button type="button" onClick={() => setActiveMainTab("edit")} data-testid="nav-assembly">
          {t("assembly")}
        </button>
        <button type="button" onClick={() => setActiveMainTab("preview")} data-testid="nav-preview">
          {t("fragments")}
        </button>
        <button type="button" onClick={() => setActiveMainTab("history")} data-testid="nav-history">
          {t("history")}
        </button>
      </nav>
      <div style={{ marginTop: 16, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
        {activeWorkspace?.status ? tMaybe(t, activeWorkspace.status) : t("no_workspace_selected")}
      </div>
    </div>
  );
}
