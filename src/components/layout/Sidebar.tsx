import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { createWorkspaceWithFirstDocument } from "@/app/data/workspaceData";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectVisibleDocuments } from "@/store/selectors";

export function Sidebar() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const workspaces = useAppStore((state) => state.workspaces);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const setActiveDocument = useAppStore((state) => state.setActiveDocument);
  const setSettingsDialogOpen = useAppStore((state) => state.setSettingsDialogOpen);
  const setDocumentStatusMessage = useAppStore((state) => state.setDocumentStatusMessage);
  const documents = useAppStore(useShallow(selectVisibleDocuments));
  const activeDocument = useAppStore(selectActiveDocument);

  const handleCreateWorkspace = async () => {
    const result = await dialog.prompt({ title: t("workspace_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      await createWorkspaceWithFirstDocument(name);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleSelectDocument = (documentId: string) => {
    setActiveDocument(documentId);
  };

  const handleReportStatus = () => {
    if (!activeDocument) return;
    setDocumentStatusMessage(activeDocument.id, null);
  };

  const listItemStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "var(--space-2)",
    padding: "var(--space-2) var(--space-3)",
    borderRadius: "var(--radius-md)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "hsl(var(--border))",
    background: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
    cursor: "pointer",
    position: "relative",
    outline: "none",
    boxShadow: "none",
    overflow: "hidden",
    width: "100%",
    textAlign: "left",
  } as const;

  const listItemActiveStyle = {
    ...listItemStyle,
    borderColor: "transparent",
    background: "color-mix(in srgb, hsl(var(--primary)) 5%, hsl(var(--card)))",
  } as const;

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
  } as const;

  return (
    <div className="panel-scroll" style={{ padding: "var(--space-3) var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {t("workspaces")}
        </div>
        {workspaces.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {t("no_workspace_selected")}
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--space-2)",
            }}
          >
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              return (
                <li key={workspace.id}>
                  <button
                    type="button"
                    onClick={() => setActiveWorkspace(workspace.id)}
                    data-testid={`sidebar-workspace-${workspace.id}`}
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "page" : undefined}
                    style={isActive ? listItemActiveStyle : listItemStyle}
                  >
                    <span
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {workspace.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <span>{t("documents")}</span>
          <span data-testid="sidebar-document-count">
            {t("fragment_count", { count: documents.length })}
          </span>
        </div>
        {documents.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {t("no_documents")}
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--space-2)",
            }}
          >
            {documents.map((document) => {
              const isActive = document.id === activeDocument?.id;
              return (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectDocument(document.id)}
                    data-testid={`sidebar-document-${document.id}`}
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "page" : undefined}
                    style={isActive ? listItemActiveStyle : listItemStyle}
                  >
                    <span
                      style={{
                        display: "flex",
                        flex: 1,
                        minWidth: 0,
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {document.name}
                      </span>
                      {document.targetPath ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: "hsl(var(--muted-foreground))",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {document.targetPath}
                        </span>
                      ) : null}
                    </span>
                    <span
                      data-testid={`sidebar-document-status-${document.id}`}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "hsl(var(--muted))",
                        color: "hsl(var(--muted-foreground))",
                        flexShrink: 0,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tMaybe(t, document.fileStatus)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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
                setSettingsDialogOpen(true);
              }}
              style={{
                ...dropdownItemStyle,
                opacity: activeWorkspaceId ? 1 : 0.5,
                cursor: activeWorkspaceId ? "pointer" : "not-allowed",
              }}
            >
              {t("workspace_settings")}
            </DropdownMenu.Item>
            {activeDocument ? (
              <DropdownMenu.Item
                data-testid="sidebar-clear-status"
                onSelect={() => handleReportStatus()}
                style={dropdownItemStyle}
              >
                {t("clear_status")}
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {activeDocument?.fileStatus === "missing_target" ? (
        <button
          type="button"
          onClick={() => setSettingsDialogOpen(true)}
          data-testid="sidebar-status-missing-target"
          style={{
            marginTop: "var(--space-4)",
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 6,
            border: "1px solid color-mix(in srgb, hsl(8 70% 45%) 35%, hsl(var(--border)))",
            background: "color-mix(in srgb, hsl(8 70% 45%) 8%, hsl(var(--card)))",
            color: "hsl(8 70% 40%)",
            fontSize: 12,
            cursor: "pointer",
            transition: "background 120ms, border-color 120ms",
          }}
        >
          {tMaybe(t, activeDocument.fileStatus)}
        </button>
      ) : (
        <div
          style={{
            marginTop: "var(--space-4)",
            fontSize: 12,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {activeDocument?.fileStatus
            ? tMaybe(t, activeDocument.fileStatus)
            : t("no_workspace_selected")}
        </div>
      )}
    </div>
  );
}
