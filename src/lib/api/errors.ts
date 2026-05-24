import { normalizeAppError } from "@/lib/appError";

export type ApiErrorCode =
  | "database_error"
  | "external_conflict"
  | "import_schema_mismatch"
  | "invalid_import_mode"
  | "invalid_target_path"
  | "missing_import_id_mapping"
  | "missing_workspace_or_recipe"
  | "snapshot_not_found"
  | "target_missing"
  | "target_not_writable"
  | "unknown";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "database_error",
  "external_conflict",
  "import_schema_mismatch",
  "invalid_import_mode",
  "invalid_target_path",
  "missing_import_id_mapping",
  "missing_workspace_or_recipe",
  "snapshot_not_found",
  "target_missing",
  "target_not_writable",
  "unknown",
]);

export function normalizeApiErrorCode(error: unknown): ApiErrorCode {
  const candidate = normalizeAppError(error);
  return (KNOWN_CODES.has(candidate) ? candidate : "unknown") as ApiErrorCode;
}
