import { tauriInvoke } from "./tauri";
import type { SearchResult } from "./types";

export async function searchWorkspaceContent(query: string, limit = 8) {
  return await tauriInvoke<SearchResult[]>("search_workspace_content", { query, limit });
}
