import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import {
  refreshWorkspaceBundleToStore,
  refreshWorkspaceListToStore,
} from "../data/workspaceRefresh";

type WorkspaceStatusPayload =
  | ""
  | "workspace_created"
  | "workspace_updated"
  | "workspace_deleted"
  | "workspace_synced"
  | "fragment_created"
  | "fragment_updated"
  | "fragment_deleted"
  | "fragment_restored"
  | "recipe_created"
  | "recipe_activated"
  | "recipe_items_updated"
  | "snapshot_created"
  | "snapshot_restored"
  | "external_conflict"
  | "conflict_imported_as_fragment"
  | "database_error"
  | "target_missing"
  | "target_not_writable"
  | "invalid_target_path"
  | "invalid_import_mode"
  | "markdown_imported"
  | "workspace_package_imported";

type WorkspaceStatusEventPayload =
  | WorkspaceStatusPayload
  | {
      kind: WorkspaceStatusPayload;
      workspace_id?: string | null;
    };

export function useWorkspaceStatusEvents() {
  const loadWorkspaces = useAppStore((state) => state.loadWorkspaces);
  const setWorkspaceList = useAppStore((state) => state.setWorkspaceList);
  const setWorkspaceBundle = useAppStore((state) => state.setWorkspaceBundle);
  const updateWorkspaceSummary = useAppStore((state) => state.updateWorkspaceSummary);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<WorkspaceStatusEventPayload>("workspace-status-updated", (event) => {
      const rawPayload = event.payload;
      const payload = typeof rawPayload === "string" ? rawPayload : (rawPayload?.kind ?? "");
      const workspaceId =
        typeof rawPayload === "string" ? null : (rawPayload?.workspace_id ?? null);
      if (payload) {
        setWorkspaceStatusMessage(payload);
      }

      if (payload === "external_conflict" || payload === "conflict_imported_as_fragment") {
        setCompileStatus("conflicted");
        const nextId = workspaceId ?? useAppStore.getState().activeWorkspaceId;
        if (nextId) {
          updateWorkspaceSummary(nextId, { status: "conflicted" });
        }
      } else if (
        payload === "database_error" ||
        payload === "target_missing" ||
        payload === "target_not_writable" ||
        payload === "invalid_target_path" ||
        payload === "invalid_import_mode"
      ) {
        setCompileStatus("error");
        const nextId = workspaceId ?? useAppStore.getState().activeWorkspaceId;
        if (nextId) {
          updateWorkspaceSummary(nextId, { status: "error" });
        }
      } else if (
        payload === "workspace_synced" ||
        payload === "workspace_created" ||
        payload === "workspace_updated" ||
        payload === "fragment_created" ||
        payload === "fragment_updated" ||
        payload === "fragment_deleted" ||
        payload === "fragment_restored" ||
        payload === "recipe_created" ||
        payload === "recipe_activated" ||
        payload === "recipe_items_updated" ||
        payload === "snapshot_created" ||
        payload === "snapshot_restored" ||
        payload === "markdown_imported" ||
        payload === "workspace_package_imported"
      ) {
        setCompileStatus("synced");
        const activeId = workspaceId ?? useAppStore.getState().activeWorkspaceId;
        if (
          payload === "fragment_created" ||
          payload === "fragment_updated" ||
          payload === "fragment_deleted" ||
          payload === "fragment_restored" ||
          payload === "recipe_created" ||
          payload === "recipe_activated" ||
          payload === "recipe_items_updated" ||
          payload === "markdown_imported" ||
          payload === "workspace_package_imported"
        ) {
          if (activeId) {
            updateWorkspaceSummary(activeId, { status: "dirty" });
          }
        }
      }

      if (
        payload === "workspace_created" ||
        payload === "workspace_updated" ||
        payload === "workspace_deleted" ||
        payload === "workspace_synced" ||
        payload === "workspace_package_imported"
      ) {
        void refreshWorkspaceListToStore({ loadWorkspaces, setWorkspaceList }).then(() => {
          void refreshWorkspaceBundleToStore({
            workspaceId: useAppStore.getState().activeWorkspaceId,
            setWorkspaceBundle,
          });
        });
        return;
      }

      void refreshWorkspaceBundleToStore({
        workspaceId: useAppStore.getState().activeWorkspaceId,
        setWorkspaceBundle,
      });
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [
    loadWorkspaces,
    setCompileStatus,
    setWorkspaceBundle,
    setWorkspaceList,
    setWorkspaceStatusMessage,
    updateWorkspaceSummary,
  ]);
}
