import { tauriInvoke } from "./tauri";

export type ConflictPolicy =
  | "import_as_fragment"
  | "overwrite_target"
  | "backup_then_overwrite"
  | "safe_sync";

export async function writeTargetFile(args: {
  workspaceId: string;
  conflictPolicy: ConflictPolicy;
}) {
  await tauriInvoke("write_target_file", {
    workspaceId: args.workspaceId,
    conflictPolicy: args.conflictPolicy,
  });
}
