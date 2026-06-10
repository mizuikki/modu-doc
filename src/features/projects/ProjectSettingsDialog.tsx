import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { updateProject } from "@/lib/api/projects";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveProject } from "@/store/selectors";

export type ProjectSettingsSection = "general" | "sync";

type ProjectSettingsDialogProps = {
  trigger?: ReactNode;
  defaultSection?: ProjectSettingsSection;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ConflictPolicy =
  | "safe_sync"
  | "overwrite_target"
  | "backup_then_overwrite"
  | "import_as_fragment";

const SECTIONS: { id: ProjectSettingsSection; labelKey: string; testId: string }[] = [
  { id: "general", labelKey: "settings_section_general", testId: "project-settings-nav-general" },
  { id: "sync", labelKey: "settings_section_sync", testId: "project-settings-nav-sync" },
];

export function ProjectSettingsDialog({
  trigger,
  defaultSection = "general",
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: ProjectSettingsDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeProject = useAppStore(selectActiveProject);
  const setDocumentStatusMessage = useAppStore((state) => state.setDocumentStatusMessage);
  const [internalOpen, setInternalOpen] = useState(false);
  const [section, setSection] = useState<ProjectSettingsSection>(defaultSection);
  const [name, setName] = useState(activeProject?.name ?? "");
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>("safe_sync");

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChangeProp?.(next);
  };

  useEffect(() => {
    if (open) setSection(defaultSection);
  }, [open, defaultSection]);

  useEffect(() => {
    if (open) {
      setName(activeProject?.name ?? "");
    }
  }, [activeProject?.name, open]);

  const handleSave = async () => {
    if (!activeProjectId) return;
    const trimmedName = name.trim();
    try {
      await updateProject({
        id: activeProjectId,
        name: trimmedName || null,
      });
      setOpen(false);
    } catch (error) {
      const message = normalizeAppError(error);
      // Project-level errors don't have a documentId; surface via the first
      // visible document if there is one, otherwise fall back to a toast.
      const firstDocumentId = useAppStore.getState().documents[0]?.id ?? null;
      if (firstDocumentId) {
        setDocumentStatusMessage(firstDocumentId, message);
      }
      toast.error(message, t("action_failed"));
    }
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setName(activeProject?.name ?? "");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {!isControlled &&
        (trigger ? (
          <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        ) : (
          <Dialog.Trigger asChild>
            <button
              type="button"
              disabled={!activeProjectId}
              data-testid="project-settings-open"
              style={{
                textAlign: "left",
                justifyContent: "flex-start",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            >
              {t("project_settings")}
            </button>
          </Dialog.Trigger>
        ))}
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
            <Dialog.Title style={{ margin: 0, fontSize: 18 }}>{t("project_settings")}</Dialog.Title>
            <Dialog.Description
              style={{ color: "hsl(var(--muted-foreground))", fontSize: 12, marginTop: 4 }}
            >
              {t("project_settings_desc")}
            </Dialog.Description>
          </div>
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <nav
              aria-label={t("project_settings")}
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
                    <span style={labelTextStyle}>{t("project_name")}</span>
                    <input
                      data-testid="project-settings-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {tMaybe(t, "project_target_per_document_hint")}
                  </p>
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
              {t(section === "general" ? "project_settings_desc" : "settings_unsaved_hint")}
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Dialog.Close asChild>
                <button type="button" data-testid="project-settings-cancel">
                  {t("cancel")}
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleSave}
                disabled={!activeProjectId}
                data-testid="project-settings-save"
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
