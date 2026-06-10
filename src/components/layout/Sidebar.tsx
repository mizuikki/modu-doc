import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { createProjectWithFirstDocument, fetchProjectBundle } from "@/app/data/projectData";
import { mapDocument } from "@/app/projectMappers";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { createDocument } from "@/lib/api/documents";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectVisibleDocuments } from "@/store/selectors";
import type { DocumentSaveState } from "@/store/types";

type DocumentIndicator = {
  tone: "unsaved" | "conflict" | "error";
  labelKey: string;
};

export function Sidebar() {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const projects = useAppStore((state) => state.projects);
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const setActiveDocument = useAppStore((state) => state.setActiveDocument);
  const patchDocument = useAppStore((state) => state.patchDocument);
  const setCenterMode = useAppStore((state) => state.setCenterMode);
  const setSettingsDialogOpen = useAppStore((state) => state.setSettingsDialogOpen);
  const setDocumentStatusMessage = useAppStore((state) => state.setDocumentStatusMessage);
  const documents = useAppStore(useShallow(selectVisibleDocuments));
  const activeDocument = useAppStore(selectActiveDocument);
  const documentDrafts = useAppStore((state) => state.documentDrafts);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  const handleCreateProject = async () => {
    const result = await dialog.prompt({ title: t("project_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      await createProjectWithFirstDocument(name);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleSelectProject = async (projectId: string) => {
    setActiveProject(projectId);
    try {
      await fetchProjectBundle(projectId);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleSelectDocument = (documentId: string) => {
    setActiveDocument(documentId);
  };

  const handleCreateDocument = async () => {
    if (!activeProjectId) return;
    const result = await dialog.prompt({
      title: t("document_name_prompt"),
      defaultValue: "Untitled.md",
    });
    if (!result.ok) return;
    const name = result.value.trim() || "Untitled.md";
    try {
      const created = await createDocument({ projectId: activeProjectId, name });
      patchDocument(created.id, mapDocument(created));
      setActiveDocument(created.id);
      setCenterMode("edit");
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  const handleClearStatus = () => {
    if (!activeDocument) return;
    setDocumentStatusMessage(activeDocument.id, null);
  };

  return (
    <div className="panel-scroll sidebar-panel">
      <section className="sidebar-project-area" aria-label={t("project")}>
        <div className="sidebar-section-label">{t("project")}</div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="sidebar-project-switcher"
              data-testid="sidebar-project-switcher"
              data-current-project-id={activeProjectId ?? ""}
              title={activeProject?.name ?? t("select_project")}
            >
              <span className="sidebar-project-name">
                {activeProject?.name ?? t("select_project")}
              </span>
              <ChevronDown aria-hidden size={14} strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={8}
              collisionPadding={12}
              data-testid="sidebar-project-menu"
              className="sidebar-project-menu"
            >
              <DropdownMenu.Label className="sidebar-menu-label">
                {t("select_project")}
              </DropdownMenu.Label>
              <div className="sidebar-project-menu-list">
                {projects.map((project) => {
                  const isActive = project.id === activeProjectId;
                  return (
                    <DropdownMenu.Item
                      key={project.id}
                      className="sidebar-menu-item"
                      data-testid={`sidebar-project-${project.id}`}
                      data-active={isActive ? "true" : "false"}
                      title={project.name}
                      onSelect={() => {
                        void handleSelectProject(project.id);
                      }}
                    >
                      <span className="sidebar-menu-item-text">{project.name}</span>
                      {isActive ? <span aria-hidden>✓</span> : null}
                    </DropdownMenu.Item>
                  );
                })}
              </div>
              <DropdownMenu.Separator className="sidebar-menu-separator" />
              <DropdownMenu.Item
                className="sidebar-menu-item"
                data-testid="sidebar-new-project"
                onSelect={() => {
                  void handleCreateProject();
                }}
              >
                {t("new_project")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="sidebar-menu-item"
                data-testid="sidebar-project-settings"
                disabled={!activeProjectId}
                onSelect={() => {
                  setSettingsDialogOpen(true);
                }}
              >
                {t("project_settings")}
              </DropdownMenu.Item>
              {activeDocument ? (
                <DropdownMenu.Item
                  className="sidebar-menu-item"
                  data-testid="sidebar-clear-status"
                  onSelect={handleClearStatus}
                >
                  {t("clear_status")}
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </section>

      <section className="sidebar-document-area" aria-label={t("documents")}>
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">{t("documents")}</span>
          <span className="sidebar-document-tools">
            <span className="sidebar-document-count" data-testid="sidebar-document-count">
              {t("document_count", { count: documents.length })}
            </span>
            <button
              type="button"
              className="sidebar-icon-button"
              data-testid="document-list-new"
              onClick={() => void handleCreateDocument()}
              disabled={!activeProjectId}
              aria-label={t("new_document_cmd")}
              title={t("new_document_cmd")}
            >
              <Plus aria-hidden size={13} strokeWidth={2.4} />
            </button>
          </span>
        </div>
        {documents.length === 0 ? (
          <div className="sidebar-empty">{t("no_documents")}</div>
        ) : (
          <ul className="sidebar-document-list">
            {documents.map((document) => {
              const isActive = document.id === activeDocument?.id;
              const draft = documentDrafts[document.id];
              const hasLocalChanges = draft !== undefined && draft !== document.content;
              const indicator = getDocumentIndicator(document.saveState, hasLocalChanges);
              const subtitle = document.targetPath
                ? basename(document.targetPath)
                : t("local_draft");
              const statusLabel = indicator
                ? tMaybe(t, indicator.labelKey)
                : tMaybe(t, document.saveState);
              const itemTitle = `${document.name} · ${subtitle} · ${statusLabel}`;
              return (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectDocument(document.id)}
                    data-testid={`sidebar-document-${document.id}`}
                    data-active={isActive ? "true" : "false"}
                    data-save-state={document.saveState}
                    aria-current={isActive ? "page" : undefined}
                    title={itemTitle}
                    className="sidebar-document-item"
                  >
                    <span className="sidebar-document-copy">
                      <span className="sidebar-document-title">{document.name}</span>
                      <span className="sidebar-document-subtitle">{subtitle}</span>
                    </span>
                    {indicator ? (
                      <span
                        className={`sidebar-document-indicator is-${indicator.tone}`}
                        data-testid={`sidebar-document-status-${document.id}`}
                        title={tMaybe(t, indicator.labelKey)}
                        role="img"
                        aria-label={tMaybe(t, indicator.labelKey)}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function basename(path: string): string {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path;
}

function getDocumentIndicator(
  saveState: DocumentSaveState,
  hasLocalChanges: boolean,
): DocumentIndicator | null {
  if (saveState === "conflict") {
    return { tone: "conflict", labelKey: "file_changed_externally" };
  }
  if (saveState === "error") {
    return { tone: "error", labelKey: "save_failed" };
  }
  if (hasLocalChanges || saveState === "unsaved") {
    return { tone: "unsaved", labelKey: "unsaved_changes" };
  }
  return null;
}
