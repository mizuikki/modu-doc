import type { ConflictPolicy } from "./api/documents";
import {
  resolveDocumentConflict as apiResolveDocumentConflict,
  writeDocumentToFile as apiWriteDocumentToFile,
} from "./api/documents";
import { normalizeAppError } from "./appError";

export const SAFE_SYNC_POLICY: ConflictPolicy = "overwrite_external";

/**
 * Phase 1: write a single document to its bound target file. This replaces
 * the old workspace-level `writeTargetFile` (which has been removed in
 * document-first mode). Pass the active document id directly.
 */
export async function writeTargetFile(documentId: string, _conflictPolicy: string) {
  // The conflictPolicy arg is kept for backwards API compatibility; the
  // document-level API takes a single `id`. The actual conflict resolution
  // policy is applied later via `resolveDocumentConflict` if needed.
  void _conflictPolicy;
  await apiWriteDocumentToFile(documentId);
}

/**
 * Resolve an external conflict on a document. Returns the updated document
 * wire from the backend.
 */
export async function resolveConflict(documentId: string, policy: ConflictPolicy) {
  return await apiResolveDocumentConflict({ id: documentId, policy });
}

/**
 * Helper for callers that want a single function to interpret an error from
 * `writeDocumentToFile`. Returns a normalised message and a process status
 * to display.
 */
export function applyWorkspaceWriteError(error: unknown): {
  message: string;
  status: "conflicted" | "error";
} {
  const message = normalizeAppError(error);
  return {
    message,
    status: message === "external_conflict" ? "conflicted" : "error",
  };
}
