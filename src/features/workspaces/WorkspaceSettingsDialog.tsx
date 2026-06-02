import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { save } from "@tauri-apps/plugin-dialog";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { updateWorkspace } from "@/lib/api/workspaces";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export type WorkspaceSettingsSection = "general" | "sync" | "import-export";

type WorkspaceSettingsDialogProps = {
  trigger?: ReactNode;
  defaultSection?: WorkspaceSettingsSection;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ConflictPolicy =
  | "safe_sync"
  | "overwrite_target"
  | "backup_then_overwrite"
  | "import_as_fragment";
type ImportStrategy = "import_as_fragment" | "keep_as_single_chunk";
type MarkdownSplitRule = "h2" | "h1" | "none";

const SECTIONS: { id: WorkspaceSettingsSection; labelKey: string; testId: string }[] = [
  { id: "general", labelKey: "settings_section_general", testId: "workspace-settings-nav-general" },
  { id: "sync", labelKey: "settings_section_sync", testId: "workspace-settings-nav-sync" },
  {
    id: "import-export",
    labelKey: "settings_section_import_export",
    testId: "workspace-settings-nav-import-export",
  },
];

export function WorkspaceSettingsDialog({
  trigger,
  defaultSection = "general",
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: WorkspaceSettingsDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const [internalOpen, setInternalOpen] = useState(false);
  const [section, setSection] = useState<WorkspaceSettingsSection>(defaultSection);
  const [name, setName] = useState(activeWorkspace?.name ?? "");
  const [targetPath, setTargetPath] = useState(activeWorkspace?.targetPath ?? "");
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>("safe_sync");
  const [autoSyncOnEdit, setAutoSyncOnEdit] = useState(true);
  const [syncDebounceMs, setSyncDebounceMs] = useState(800);
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>("import_as_fragment");
  const [markdownSplitRule, setMarkdownSplitRule] = useState<MarkdownSplitRule>("h2");
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChangeProp?.(next);
  };

  useEffect(() => {
    if (open) setSection(defaultSection);
  }, [open, defaultSection]);

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

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setName(activeWorkspace?.name ?? "");
      setTargetPath(activeWorkspace?.targetPath ?? "");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      ) : (
        <Dialog.Trigger asChild>
          <button
            type="button"
            disabled={!activeWorkspaceId}
            data-testid="workspace-settings-open"
            style={{
              textAlign: "left",
              justifyContent: "flex-start",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            {t("workspace_settings")}
          </button>
        </Dialog.Trigger>
      )}
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
            width: "min(720px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 64px)",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 16,
            boxShadow: "0 24px 72px rgba(15, 23, 42, 0.22)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px 24px 12px",
              borderBottom: "1px solid hsl(var(--border))",
            }}
          >
            <Dialog.Title style={{ margin: 0, fontSize: 18 }}>
              {t("workspace_settings")}
            </Dialog.Title>
            <Dialog.Description
              style={{ color: "hsl(var(--muted-foreground))", fontSize: 12, marginTop: 4 }}
            >
              {t("workspace_settings_desc")}
            </Dialog.Description>
          </div>
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <nav
              aria-label={t("workspace_settings")}
              style={{
                width: 200,
                flexShrink: 0,
                borderRight: "1px solid hsl(var(--border))",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "hsl(var(--muted))",
              }}
            >
              {SECTIONS.map((item) => {
                const isActive = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    data-testid={item.testId}
                    data-active={isActive}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid transparent",
                      background: isActive ? "hsl(var(--card))" : "transparent",
                      color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                      boxShadow: isActive ? "var(--elevation-1)" : "none",
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {tMaybe(t, item.labelKey)}
                  </button>
                );
              })}
            </nav>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                overflowY: "auto",
              }}
            >
              {section === "general" ? (
                <>
                  <SectionHeader
                    titleKey="settings_section_general"
                    descKey="settings_section_general_desc"
                  />
                  <label style={labeledFieldStyle}>
                    <span style={labelTextStyle}>{t("workspace_name")}</span>
                    <input
                      data-testid="workspace-settings-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labeledFieldStyle}>
                    <span style={labelTextStyle}>{t("target_file")}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        data-testid="workspace-settings-target"
                        value={targetPath}
                        onChange={(event) => setTargetPath(event.target.value)}
                        placeholder={t("target_path_prompt")}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={chooseTarget}
                        data-testid="workspace-settings-choose"
                      >
                        {t("choose_target")}
                      </button>
                    </div>
                    <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
                      {t("current_target")}: {activeWorkspace?.targetPath ?? t("missing_target")}
                    </span>
                  </label>
                </>
              ) : null}
              {section === "sync" ? (
                <>
                  <SectionHeader
                    titleKey="settings_section_sync"
                    descKey="settings_section_sync_desc"
                  />
                  <Group legend={t("conflict_policy")}>
                    <RadioGroup
                      name="conflict-policy"
                      value={conflictPolicy}
                      onChange={(value) => setConflictPolicy(value as ConflictPolicy)}
                      options={[
                        { value: "safe_sync", label: t("conflict_policy_safe_sync") },
                        { value: "overwrite_target", label: t("conflict_policy_overwrite_target") },
                        {
                          value: "backup_then_overwrite",
                          label: t("conflict_policy_backup_then_overwrite"),
                        },
                        {
                          value: "import_as_fragment",
                          label: t("conflict_policy_import_as_fragment"),
                        },
                      ]}
                    />
                  </Group>
                  <Group legend={t("auto_sync_on_edit")} horizontal>
                    <Switch.Root
                      checked={autoSyncOnEdit}
                      onCheckedChange={setAutoSyncOnEdit}
                      data-testid="workspace-settings-auto-sync"
                      style={{
                        width: 36,
                        height: 20,
                        background: autoSyncOnEdit ? "hsl(var(--primary))" : "hsl(var(--muted))",
                        borderRadius: 999,
                        position: "relative",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      <Switch.Thumb
                        style={{
                          display: "block",
                          width: 16,
                          height: 16,
                          background: "hsl(var(--card))",
                          borderRadius: 999,
                          boxShadow: "var(--elevation-1)",
                          transform: autoSyncOnEdit ? "translateX(18px)" : "translateX(2px)",
                          transition: "transform 120ms ease",
                        }}
                      />
                    </Switch.Root>
                  </Group>
                  <label style={labeledFieldStyle}>
                    <span style={labelTextStyle}>{t("sync_debounce_ms")}</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      data-testid="workspace-settings-sync-debounce"
                      value={syncDebounceMs}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        setSyncDebounceMs(Number.isFinite(next) && next >= 0 ? next : 0);
                      }}
                      style={inputStyle}
                    />
                  </label>
                  <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {t("settings_unsaved_hint")}
                  </p>
                </>
              ) : null}
              {section === "import-export" ? (
                <>
                  <SectionHeader
                    titleKey="settings_section_import_export"
                    descKey="settings_section_import_export_desc"
                  />
                  <Group legend={t("import_strategy")}>
                    <RadioGroup
                      name="import-strategy"
                      value={importStrategy}
                      onChange={(value) => setImportStrategy(value as ImportStrategy)}
                      options={[
                        {
                          value: "import_as_fragment",
                          label: t("import_strategy_import_as_fragment"),
                        },
                        {
                          value: "keep_as_single_chunk",
                          label: t("import_strategy_keep_as_single_chunk"),
                        },
                      ]}
                    />
                  </Group>
                  <Group legend={t("markdown_split_rule")}>
                    <RadioGroup
                      name="markdown-split-rule"
                      value={markdownSplitRule}
                      onChange={(value) => setMarkdownSplitRule(value as MarkdownSplitRule)}
                      options={[
                        { value: "h2", label: t("split_by_h2") },
                        { value: "h1", label: t("split_by_h1") },
                        { value: "none", label: t("no_split") },
                      ]}
                    />
                  </Group>
                  <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {t("settings_unsaved_hint")}
                  </p>
                </>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 20px",
              borderTop: "1px solid hsl(var(--border))",
              background: "hsl(var(--muted))",
            }}
          >
            <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {t(section === "general" ? "workspace_settings_desc" : "settings_unsaved_hint")}
            </span>
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
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "transparent",
  color: "inherit",
};

const labeledFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 12,
};

const labelTextStyle: React.CSSProperties = {
  color: "hsl(var(--muted-foreground))",
};

function Group({
  legend,
  horizontal,
  children,
}: {
  legend: string;
  horizontal?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: horizontal ? "center" : "stretch",
        justifyContent: horizontal ? "space-between" : "flex-start",
        gap: horizontal ? 12 : 8,
        fontSize: 12,
        border: 0,
        padding: 0,
        margin: 0,
        minWidth: 0,
      }}
    >
      <legend
        style={{
          padding: 0,
          color: "hsl(var(--muted-foreground))",
          minWidth: horizontal ? undefined : 0,
        }}
      >
        {legend}
      </legend>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: horizontal ? 0 : undefined,
          minWidth: horizontal ? 0 : undefined,
        }}
      >
        {children}
      </div>
    </fieldset>
  );
}

function SectionHeader({ titleKey, descKey }: { titleKey: string; descKey: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{tMaybe(t, titleKey)}</h3>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
        {tMaybe(t, descKey)}
      </p>
    </div>
  );
}

function RadioGroup({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: value === option.value ? "hsl(var(--muted))" : "transparent",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <input
              type="radio"
              id={id}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
