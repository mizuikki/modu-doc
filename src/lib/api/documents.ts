import { tauriInvoke } from "./tauri";
import type { DocumentConflictStatus, DocumentWire } from "./types";

export async function createDocument(args: {
  workspaceId: string;
  name: string;
  content?: string | null;
  targetPath?: string | null;
  description?: string | null;
}) {
  return await tauriInvoke<DocumentWire>("create_document", {
    workspaceId: args.workspaceId,
    name: args.name,
    content: args.content ?? null,
    targetPath: args.targetPath ?? null,
    description: args.description ?? null,
  });
}

export async function updateDocument(args: {
  id: string;
  name?: string | null;
  content?: string | null;
  targetPath?: string | null;
  clearTargetPath?: boolean;
  description?: string | null;
}) {
  return await tauriInvoke<DocumentWire>("update_document", {
    id: args.id,
    name: args.name ?? null,
    content: args.content ?? null,
    targetPath: args.targetPath ?? null,
    clearTargetPath: args.clearTargetPath ?? false,
    description: args.description ?? null,
  });
}

export async function softDeleteDocument(id: string) {
  await tauriInvoke("soft_delete_document", { id });
}

export async function restoreDocument(id: string) {
  return await tauriInvoke<DocumentWire>("restore_document", { id });
}

export async function deleteDocumentPermanently(args: { id: string; deleteTargetFile?: boolean }) {
  await tauriInvoke("delete_document_permanently", {
    id: args.id,
    deleteTargetFile: args.deleteTargetFile ?? false,
  });
}

export async function reorderDocuments(args: {
  workspaceId: string;
  orderedDocumentIds: string[];
}) {
  await tauriInvoke("reorder_documents", {
    workspaceId: args.workspaceId,
    orderedDocumentIds: args.orderedDocumentIds,
  });
}

export async function writeDocumentToFile(id: string) {
  return await tauriInvoke<DocumentWire>("write_document_to_file", { id });
}

export async function checkDocumentConflict(id: string) {
  return await tauriInvoke<DocumentConflictStatus>("check_document_conflict", { id });
}

export type ConflictPolicy =
  | "import_external"
  | "overwrite_external"
  | "backup_and_overwrite"
  | "cancel";

export async function resolveDocumentConflict(args: { id: string; policy: ConflictPolicy }) {
  return await tauriInvoke<DocumentWire>("resolve_document_conflict", args);
}
