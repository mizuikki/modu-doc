import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
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
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const snapshots = useAppStore((state) => state.snapshots);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const recipes = useAppStore((state) => state.recipes);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fragmentsCount = fragments.filter(
    (entry) => entry.workspaceId === activeWorkspaceId && entry.deletedAt === null,
  ).length;
  const workspaceRecipeIds = new Set(
    recipes.filter((recipe) => recipe.workspaceId === activeWorkspaceId).map((recipe) => recipe.id),
  );
  const currentRecipeItems = recipeItems.filter((item) => workspaceRecipeIds.has(item.recipeId));
  const activeRecipeItems = currentRecipeItems.filter((item) => item.recipeId === activeRecipeId);
  const assemblyEnabled =
    activeRecipeItems.length > 0
      ? activeRecipeItems.filter((item) => item.enabled).length
      : currentRecipeItems.filter((item) => item.enabled).length;
  const assemblyTotal =
    activeRecipeItems.length > 0 ? activeRecipeItems.length : currentRecipeItems.length;
  const snapshotsCount = snapshots.filter(
    (snapshot) => snapshot.workspaceId === activeWorkspaceId,
  ).length;

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

  const navButtonStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-2) var(--space-3)",
    borderRadius: "var(--radius-md)",
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
    cursor: "pointer",
  };

  const badgeStyle = {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "hsl(var(--muted))",
    color: "hsl(var(--muted-foreground))",
    lineHeight: 1.2,
  };

  const dropdownItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    padding: "var(--space-2) var(--space-3)",
    borderRadius: "var(--radius-md)",
    fontSize: 13,
    color: "hsl(var(--foreground))",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div className="panel-scroll" style={{ padding: "var(--space-3) var(--space-4)" }}>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <WorkspaceSelect />
      </div>
      <nav
        style={{
          display: "grid",
          gap: "var(--space-3)",
          marginBottom: "var(--space-3)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveMainTab("edit")}
          data-testid="nav-assembly"
          style={navButtonStyle}
        >
          <span>{t("assembly")}</span>
          <span data-testid="nav-assembly-count" style={badgeStyle}>
            {t("sidebar_nav_assembly_count", { enabled: assemblyEnabled, total: assemblyTotal })}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("preview")}
          data-testid="nav-preview"
          style={navButtonStyle}
        >
          <span>{t("fragments")}</span>
          <span data-testid="nav-preview-count" style={badgeStyle}>
            {t("sidebar_nav_fragments_count", { count: fragmentsCount })}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("history")}
          data-testid="nav-history"
          style={navButtonStyle}
        >
          <span>{t("history")}</span>
          <span data-testid="nav-history-count" style={badgeStyle}>
            {t("sidebar_nav_snapshots_count", { count: snapshotsCount })}
          </span>
        </button>
      </nav>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            data-testid="sidebar-more-trigger"
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              cursor: "pointer",
              textAlign: "left",
              marginBottom: "var(--space-3)",
            }}
          >
            {t("sidebar_more")}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={10}
            data-testid="sidebar-more-content"
            style={{
              minWidth: 200,
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2)",
              boxShadow: "0 10px 24px rgba(0, 0, 0, 0.14)",
              zIndex: 30,
            }}
          >
            <DropdownMenu.Item
              data-testid="sidebar-new-workspace"
              onSelect={() => {
                void handleCreateWorkspace();
              }}
              style={dropdownItemStyle}
            >
              {t("new_workspace")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="sidebar-workspace-settings"
              disabled={!activeWorkspaceId}
              onSelect={() => {
                setSettingsOpen(true);
              }}
              style={{
                ...dropdownItemStyle,
                opacity: activeWorkspaceId ? 1 : 0.5,
                cursor: activeWorkspaceId ? "pointer" : "not-allowed",
              }}
            >
              {t("workspace_settings")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="sidebar-import-markdown"
              disabled={!activeWorkspaceId}
              onSelect={() => {
                void handleImportMarkdown();
              }}
              style={{
                ...dropdownItemStyle,
                opacity: activeWorkspaceId ? 1 : 0.5,
                cursor: activeWorkspaceId ? "pointer" : "not-allowed",
              }}
            >
              {t("import_markdown")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="sidebar-export-package"
              disabled={!activeWorkspaceId}
              onSelect={() => {
                void handleExportPackage();
              }}
              style={{
                ...dropdownItemStyle,
                opacity: activeWorkspaceId ? 1 : 0.5,
                cursor: activeWorkspaceId ? "pointer" : "not-allowed",
              }}
            >
              {t("export_package")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              data-testid="sidebar-import-package"
              onSelect={() => {
                void handleImportPackage();
              }}
              style={dropdownItemStyle}
            >
              {t("import_package")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <WorkspaceSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <div
        style={{
          marginTop: "var(--space-4)",
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        {activeWorkspace?.status ? tMaybe(t, activeWorkspace.status) : t("no_workspace_selected")}
      </div>
    </div>
  );
}
