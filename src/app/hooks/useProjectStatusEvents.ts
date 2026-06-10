import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { fetchProjectBundle, fetchProjects } from "@/app/data/projectData";
import { useAppStore } from "@/store/appStore";

type DocEvent = {
  kind: string;
  project_id: string | null;
  document_id: string | null;
};

type WsEvent = {
  kind: string;
  project_id: string | null;
};

const DOC_REFRESH_KINDS = new Set([
  "document_created",
  "document_deleted",
  "document_restored",
  "document_target_updated",
  "document_updated",
  "document_written",
  "document_conflict",
  "document_conflict_resolved",
  "snapshot_created",
  "snapshot_restored",
]);

export function useProjectStatusEvents() {
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let cancelled = false;

    (async () => {
      const u1 = await listen<DocEvent>("document-status-updated", (e) => {
        if (cancelled) return;
        const { kind, project_id, document_id } = e.payload;
        const state = useAppStore.getState();
        if (DOC_REFRESH_KINDS.has(kind) && project_id && project_id === state.activeProjectId) {
          void fetchProjectBundle(project_id);
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

      const u2 = await listen<WsEvent>("project-status-updated", (e) => {
        if (cancelled) return;
        const { kind, project_id } = e.payload;
        if (kind === "project_deleted") {
          void fetchProjects();
        }
        if (kind === "project_created" || kind === "project_updated") {
          void fetchProjects();
        }
        if (project_id && project_id === useAppStore.getState().activeProjectId) {
          void fetchProjectBundle(project_id);
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
