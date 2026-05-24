import { tauriInvoke } from "./tauri";

export async function openTargetInFileManager(workspaceId: string) {
  await tauriInvoke("open_target_in_file_manager", { workspaceId });
}
