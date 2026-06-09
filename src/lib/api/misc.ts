import { tauriInvoke } from "./tauri";

export async function openTargetInFileManager(documentId: string) {
  await tauriInvoke("open_target_in_file_manager", { documentId });
}
