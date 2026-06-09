import { tauriInvoke } from "./tauri";
import type { DocumentWire, SnapshotWire } from "./types";

export async function createSnapshot(args: { documentId: string; label?: string | null }) {
  return await tauriInvoke<SnapshotWire>("create_snapshot", {
    documentId: args.documentId,
    label: args.label ?? null,
  });
}

export async function listDocumentSnapshots(documentId: string) {
  return await tauriInvoke<SnapshotWire[]>("list_document_snapshots", { documentId });
}

export type RestoreSnapshotMode = "overwrite" | "new_doc";

export async function restoreSnapshot(args: {
  documentId: string;
  snapshotId: string;
  mode: RestoreSnapshotMode;
}) {
  return await tauriInvoke<DocumentWire>("restore_snapshot", args);
}
