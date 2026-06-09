import { normalizeAppError } from "@/lib/appError";

export type ApiErrorCode =
  | "database_error"
  | "external_conflict"
  | "import_schema_mismatch" // legacy, may not appear
  | "invalid_import_mode" // legacy
  | "invalid_target_path"
  | "missing_import_id_mapping" // legacy
  | "missing_workspace_or_recipe" // legacy
  | "snapshot_not_found"
  | "target_missing"
  | "target_not_writable"
  | "target_path_in_use"
  | "document_not_found"
  | "workspace_not_found"
  | "recipe_not_found"
  | "fragment_not_found"
  | "document_deleted"
  | "unknown";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "database_error",
  "external_conflict",
  "invalid_target_path",
  "snapshot_not_found",
  "target_missing",
  "target_not_writable",
  "target_path_in_use",
  "document_not_found",
  "workspace_not_found",
  "recipe_not_found",
  "fragment_not_found",
  "document_deleted",
  "unknown",
]);

export function normalizeApiErrorCode(error: unknown): ApiErrorCode {
  const candidate = normalizeAppError(error);
  return (KNOWN_CODES.has(candidate) ? candidate : "unknown") as ApiErrorCode;
}
