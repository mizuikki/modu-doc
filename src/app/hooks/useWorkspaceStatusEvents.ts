import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { fetchWorkspaceBundle, fetchWorkspaces } from "@/app/data/workspaceData";
import { useAppStore } from "@/store/appStore";

type DocEvent = {
  kind: string;
  workspace_id: string | null;
  document_id: string | null;
};

type WsEvent = {
  kind: string;
  workspace_id: string | null;
};

const DOC_REFRESH_KINDS = new Set([
  "document_created",
  "document_deleted",
  "document_restored",
  "document_target_updated",
  "document_updated",
  "document_written",
  "document_conflicted",
  "document_conflict_resolved",
]);

export function useWorkspaceStatusEvents() {
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let cancelled = false;

    (async () => {
      const u1 = await listen<DocEvent>("document-status-updated", (e) => {
        if (cancelled) return;
        const { kind, workspace_id, document_id } = e.payload;
        const state = useAppStore.getState();
        if (
          DOC_REFRESH_KINDS.has(kind) &&
          workspace_id &&
          workspace_id === state.activeWorkspaceId
        ) {
          void fetchWorkspaceBundle(workspace_id);
        }
        if (document_id && document_id === state.activeDocumentId) {
          // future: patch the active document from the event payload
        }
      });
      if (cancelled) {
        u1();
        return;
      }
      unlistens.push(u1);

      const u2 = await listen<WsEvent>("workspace-status-updated", (e) => {
        if (cancelled) return;
        const { kind, workspace_id } = e.payload;
        if (kind === "workspace_deleted") {
          void fetchWorkspaces();
        }
        if (kind === "workspace_created" || kind === "workspace_updated") {
          void fetchWorkspaces();
        }
        if (workspace_id && workspace_id === useAppStore.getState().activeWorkspaceId) {
          void fetchWorkspaceBundle(workspace_id);
        }
      });
      if (cancelled) {
        u2();
        return;
      }
      unlistens.push(u2);
    })();

    return () => {
      cancelled = true;
      unlistens.forEach((u) => {
        u();
      });
    };
  }, []);
}
