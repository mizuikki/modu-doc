import { browser } from "@wdio/globals";
import { tauriInvoke } from "./tauri";
import { safeClick, safeSetValue } from "./ui";

export type ProjectWire = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type DocumentWire = {
  id: string;
  project_id: string;
  name: string;
  content: string;
  content_hash: string;
  target_path: string | null;
  save_state: string;
  last_written_at: string | null;
  last_written_hash: string | null;
  sort_order: number;
  deleted_at: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FragmentWire = {
  id: string;
  project_id: string;
  name: string;
  content: string;
  content_hash: string;
  tags: string;
  category: string | null;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeWire = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeItemWire = {
  id: string;
  recipe_id: string;
  fragment_id: string;
  enabled: boolean;
  sort_order: number;
};

export type SnapshotWire = {
  id: string;
  document_id: string;
  label: string | null;
  content: string;
  content_hash: string;
  created_at: string;
};

export type ProjectLoadResult = {
  project: ProjectWire;
  documents: DocumentWire[];
  fragments: FragmentWire[];
  recipes: RecipeWire[];
  recipe_items: RecipeItemWire[];
  snapshots: Record<string, SnapshotWire[]>;
};

export type OpenProject = {
  projectId: string;
  documentId: string;
  name: string;
};

export async function openProjectSwitcher(timeoutMs = 20000) {
  await safeClick("[data-testid='sidebar-project-switcher']", timeoutMs);
  const menu = await $("[data-testid='sidebar-project-menu']");
  await browser.waitUntil(async () => await menu.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
  });
}

/**
 * Create a project via the welcome screen or project switcher and wait until the new
 * project's Untitled.md document is auto-activated. Returns the ids the e2e
 * specs need to keep working with the new bundle.
 */
export async function createAndOpenProject(
  name: string,
  options: { initialDocumentName?: string } = {},
): Promise<OpenProject> {
  // 1. Create from the empty-state welcome screen when no project exists;
  // otherwise use the sidebar "More" menu.
  const welcomeCreate = await $("[data-testid='welcome-create-project']");
  if ((await welcomeCreate.isExisting()) && (await welcomeCreate.isDisplayed())) {
    await safeClick("[data-testid='welcome-create-project']", 20000);
  } else {
    await openProjectSwitcher(20000);
    await safeClick("[data-testid='sidebar-new-project']", 20000);
  }

  // 2. Confirm the project name in the prompt dialog.
  await safeSetValue("[data-testid='app-prompt-input']", name, 20000);
  await safeClick("[data-testid='app-dialog-confirm']", 20000);

  // 3. Find the newly created project id by polling list_projects.
  const projectId = await browser.waitUntil(
    async () => {
      const list = await tauriInvoke<ProjectWire[]>("list_projects");
      const match = list.find((entry) => entry.name === name);
      return match ? match.id : null;
    },
    { timeout: 20000, interval: 200, timeoutMsg: "new project not visible in list_projects" },
  );

  // 4. Wait for the project switcher to reflect the new active project.
  await browser.waitUntil(
    async () => {
      const trigger = await $("[data-testid='sidebar-project-switcher']");
      return (await trigger.getAttribute("data-current-project-id")) === projectId;
    },
    { timeout: 20000, interval: 200 },
  );

  // 5. Wait for the auto-created Untitled.md document to become active.
  const bundle = await browser.waitUntil(
    async () => {
      const load = await tauriInvoke<ProjectLoadResult>("load_project", { id: projectId });
      const doc = load.documents.find((entry) =>
        options.initialDocumentName
          ? entry.name === options.initialDocumentName
          : entry.name === "Untitled.md",
      );
      return doc ? load : null;
    },
    { timeout: 20000, interval: 200, timeoutMsg: "Untitled.md document not auto-created" },
  );

  const documentId = bundle.documents.find((entry) =>
    options.initialDocumentName
      ? entry.name === options.initialDocumentName
      : entry.name === "Untitled.md",
  )?.id;
  if (!documentId) {
    throw new Error("Untitled.md document not found after waitUntil");
  }

  await browser.waitUntil(
    async () => (await $(`[data-testid='sidebar-document-${documentId}']`)).isExisting(),
    { timeout: 20000, interval: 200 },
  );
  await browser.waitUntil(
    async () => {
      const trigger = await $(`[data-testid='sidebar-document-${documentId}']`);
      return (await trigger.getAttribute("data-active")) === "true";
    },
    { timeout: 20000, interval: 200 },
  );

  return { projectId, documentId, name };
}

/**
 * Drive a "select project" by clicking the sidebar project row, then
 * wait for that project to become active. (The old ProjectSelect dropdown
 * is gone; the new sidebar lists every project directly.)
 */
export async function selectProjectById(projectId: string, timeoutMs = 20000) {
  await openProjectSwitcher(timeoutMs);
  await safeClick(`[data-testid='sidebar-project-${projectId}']`, timeoutMs);
  await browser.waitUntil(
    async () => {
      const trigger = await $("[data-testid='sidebar-project-switcher']");
      return (await trigger.getAttribute("data-current-project-id")) === projectId;
    },
    { timeout: timeoutMs, interval: 200 },
  );
  await browser.waitUntil(
    async () => {
      const bundle = await loadProject(projectId);
      const firstDocument = bundle.documents.find((entry) => !entry.deleted_at);
      if (!firstDocument) return true;
      return await $(`[data-testid='sidebar-document-${firstDocument.id}']`).isExisting();
    },
    { timeout: timeoutMs, interval: 200 },
  );
}

export async function loadProject(projectId: string) {
  return await tauriInvoke<ProjectLoadResult>("load_project", { id: projectId });
}

export async function deleteProject(projectId: string) {
  await tauriInvoke("delete_project", { id: projectId });
}

export async function getProjectCount(): Promise<number> {
  const list = await tauriInvoke<ProjectWire[]>("list_projects");
  return list.length;
}
