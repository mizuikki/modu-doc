import { tauriInvoke } from "./tauri";

export type MarkerKind = "hrule" | "fragment-id";

export type CompileSegment = {
  fragment_id: string;
  fragment_name: string;
  start_line: number;
  end_line: number;
  enabled: boolean;
};

export type CompileWithMarkersResult = {
  compiled_text: string;
  segments: CompileSegment[];
};

export async function compileFragmentsWithMarkers(
  workspaceId: string,
  recipeId: string,
  markerKind: MarkerKind = "hrule",
): Promise<CompileWithMarkersResult> {
  return tauriInvoke<CompileWithMarkersResult>("compile_fragments_with_markers", {
    workspaceId,
    recipeId,
    markerKind,
  });
}
