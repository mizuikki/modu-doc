import * as Dialog from "@radix-ui/react-dialog";
import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { updateWorkspace } from "@/lib/api/workspaces";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export function WorkspaceSettingsDialog() {
  const { t } = useTranslation();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(activeWorkspace?.name ?? "");
  const [targetPath, setTargetPath] = useState(activeWorkspace?.targetPath ?? "");
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);

  const chooseTarget = async () => {
    const selected = await save({
      defaultPath: targetPath || `${activeWorkspace?.name ?? "workspace"}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (selected) {
      setTargetPath(selected);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspaceId) return;
    const trimmedName = name.trim();
    const trimmedTargetPath = targetPath.trim();
    try {
      await updateWorkspace({
        id: activeWorkspaceId,
        name: trimmedName || null,
        targetPath: trimmedTargetPath || null,
        clearTargetPath: trimmedTargetPath.length === 0,
      });
      setOpen(false);
    } catch (error) {
      setWorkspaceStatusMessage(normalizeAppError(error));
      setCompileStatus("error");
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setName(activeWorkspace?.name ?? "");
          setTargetPath(activeWorkspace?.targetPath ?? "");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" disabled={!activeWorkspaceId} data-testid="workspace-settings-open">
          {t("workspace_settings")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.42)",
            backdropFilter: "blur(4px)",
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(560px, calc(100vw - 32px))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 24px 72px rgba(15, 23, 42, 0.22)",
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <Dialog.Title style={{ margin: 0, fontSize: 18 }}>
              {t("workspace_settings")}
            </Dialog.Title>
            <Dialog.Description style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
              {t("workspace_settings_desc")}
            </Dialog.Description>
          </div>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12 }}>{t("workspace_name")}</span>
            <input
              data-testid="workspace-settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                background: "transparent",
                color: "inherit",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12 }}>{t("target_file")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                data-testid="workspace-settings-target"
                value={targetPath}
                onChange={(event) => setTargetPath(event.target.value)}
                placeholder={t("target_path_prompt")}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid hsl(var(--border))",
                  background: "transparent",
                  color: "inherit",
                }}
              />
              <button type="button" onClick={chooseTarget} data-testid="workspace-settings-choose">
                {t("choose_target")}
              </button>
            </div>
            <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
              {t("current_target")}: {activeWorkspace?.targetPath ?? t("missing_target")}
            </span>
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Dialog.Close asChild>
              <button type="button" data-testid="workspace-settings-cancel">
                {t("cancel")}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSave}
              disabled={!activeWorkspaceId}
              data-testid="workspace-settings-save"
            >
              {t("save_changes")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
