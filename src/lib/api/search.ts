import { tauriInvoke } from "./tauri";
import type { SearchResult } from "./types";

export async function searchProjectContent(query: string, limit = 8) {
  return await tauriInvoke<SearchResult[]>("search_project_content", { query, limit });
}
