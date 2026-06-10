import type { ConflictPolicy } from "./documents";
import { checkDocumentConflict, resolveDocumentConflict, writeDocumentToFile } from "./documents";

// Backwards-compat re-export so consumers that imported ConflictPolicy from
// `./sync` keep working. (See `documents.ts` for the canonical definition.)
export type { ConflictPolicy };

export async function writeDocument(args: { id: string }) {
  return await writeDocumentToFile(args.id);
}

export async function checkConflict(id: string) {
  return await checkDocumentConflict(id);
}

export async function resolveConflict(args: { id: string; policy: ConflictPolicy }) {
  return await resolveDocumentConflict(args);
}
