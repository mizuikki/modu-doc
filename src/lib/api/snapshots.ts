import { tauriInvoke } from "./tauri";

export async function createSnapshot(args: { workspaceId: string; label?: string | null }) {
  await tauriInvoke("create_snapshot", {
    workspaceId: args.workspaceId,
    label: args.label ?? null,
  });
}

export async function restoreSnapshot(snapshotId: string) {
  await tauriInvoke("restore_snapshot", { snapshotId });
}
