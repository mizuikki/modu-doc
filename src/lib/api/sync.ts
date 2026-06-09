import type { ConflictPolicy } from "./documents";
import { tauriInvoke } from "./tauri";
import type { DocumentWire } from "./types";

// Backwards-compat re-export so consumers that imported ConflictPolicy from
// `./sync` keep working. (See `documents.ts` for the canonical definition.)
export type { ConflictPolicy };

export async function writeDocument(args: { id: string }) {
  return await tauriInvoke<DocumentWire>("write_document_to_file", { id: args.id });
}

export async function checkConflict(id: string) {
  return await tauriInvoke<{ has_conflict: boolean; external_content_hash: string | null }>(
    "check_document_conflict",
    { id },
  );
}

export async function resolveConflict(args: { id: string; policy: ConflictPolicy }) {
  return await tauriInvoke<DocumentWire>("resolve_document_conflict", args);
}
