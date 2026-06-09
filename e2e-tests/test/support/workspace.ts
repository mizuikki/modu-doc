import { browser } from "@wdio/globals";
import { tauriInvoke } from "./tauri";
import { safeClick, safeSetValue } from "./ui";

export type WorkspaceWire = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type DocumentWire = {
  id: string;
  workspace_id: string;
  name: string;
  content: string;
  content_hash: string;
  target_path: string | null;
  file_status: string;
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
  workspace_id: string;
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
  workspace_id: string;
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

export type WorkspaceLoadResult = {
  workspace: WorkspaceWire;
  documents: DocumentWire[];
  fragments: FragmentWire[];
  recipes: RecipeWire[];
  recipe_items: RecipeItemWire[];
  snapshots: Record<string, SnapshotWire[]>;
};

export type OpenWorkspace = {
  workspaceId: string;
  documentId: string;
  name: string;
};

/**
 * Create a workspace via the sidebar "More" menu and wait until the new
 * workspace's Main.md document is auto-activated. Returns the ids the e2e
 * specs need to keep working with the new bundle.
 */
export async function createAndOpenWorkspace(
  name: string,
  options: { initialDocumentName?: string } = {},
): Promise<OpenWorkspace> {
  // 1. Open the sidebar "More" menu and click "New workspace".
  await safeClick("[data-testid='sidebar-more-trigger']", 20000);
  await safeClick("[data-testid='sidebar-new-workspace']", 20000);

  // 2. Confirm the workspace name in the prompt dialog.
  await safeSetValue("[data-testid='app-prompt-input']", name, 20000);
  await safeClick("[data-testid='app-dialog-confirm']", 20000);

  // 3. Find the newly created workspace id by polling list_workspaces.
  const workspaceId = await browser.waitUntil(
    async () => {
      const list = await tauriInvoke<WorkspaceWire[]>("list_workspaces");
      const match = list.find((entry) => entry.name === name);
      return match ? match.id : null;
    },
    { timeout: 20000, interval: 200, timeoutMsg: "new workspace not visible in list_workspaces" },
  );

  // 4. Wait for the workspace sidebar row + active state.
  await browser.waitUntil(
    async () => (await $(`[data-testid='sidebar-workspace-${workspaceId}']`)).isExisting(),
    { timeout: 20000, interval: 200 },
  );
  await browser.waitUntil(
    async () => {
      const trigger = await $(`[data-testid='sidebar-workspace-${workspaceId}']`);
      return (await trigger.getAttribute("data-active")) === "true";
    },
    { timeout: 20000, interval: 200 },
  );

  // 5. Wait for the auto-created Main.md document to become active.
  const bundle = await browser.waitUntil(
    async () => {
      const load = await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id: workspaceId });
      const doc = load.documents.find((entry) =>
        options.initialDocumentName
          ? entry.name === options.initialDocumentName
          : entry.name === "Main.md",
      );
      return doc ? load : null;
    },
    { timeout: 20000, interval: 200, timeoutMsg: "Main.md document not auto-created" },
  );

  const documentId = bundle.documents.find((entry) =>
    options.initialDocumentName
      ? entry.name === options.initialDocumentName
      : entry.name === "Main.md",
  )?.id;
  if (!documentId) {
    throw new Error("Main.md document not found after waitUntil");
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

  return { workspaceId, documentId, name };
}

/**
 * Drive a "select workspace" by clicking the sidebar workspace row, then
 * wait for that workspace to become active. (The old WorkspaceSelect dropdown
 * is gone; the new sidebar lists every workspace directly.)
 */
export async function selectWorkspaceById(workspaceId: string, timeoutMs = 20000) {
  await safeClick(`[data-testid='sidebar-workspace-${workspaceId}']`, timeoutMs);
  await browser.waitUntil(
    async () => {
      const trigger = await $(`[data-testid='sidebar-workspace-${workspaceId}']`);
      return (await trigger.getAttribute("data-active")) === "true";
    },
    { timeout: timeoutMs, interval: 200 },
  );
}

export async function loadWorkspace(workspaceId: string) {
  return await tauriInvoke<WorkspaceLoadResult>("load_workspace", { id: workspaceId });
}

export async function deleteWorkspace(workspaceId: string) {
  await tauriInvoke("delete_workspace", { id: workspaceId });
}

export async function getWorkspaceCount(): Promise<number> {
  const list = await tauriInvoke<WorkspaceWire[]>("list_workspaces");
  return list.length;
}
