import { pickFirstVisibleDocument } from "./activation";
import type { AppState, LoadProjectBundleInput, SnapshotSummary } from "./types";

export function applyLoadedProjectState(
  state: AppState,
  payload: LoadProjectBundleInput,
): Pick<
  AppState,
  | "documents"
  | "fragments"
  | "recipes"
  | "recipeItems"
  | "snapshotsByDocumentId"
  | "activeDocumentId"
  | "selectedSnapshotId"
> {
  const nextActiveDocument = pickFirstVisibleDocument(payload.documents, state.activeDocumentId);
  const activeDocumentId = nextActiveDocument?.id ?? null;

  const activeSnapshots: SnapshotSummary[] = activeDocumentId
    ? (payload.snapshotsByDocumentId[activeDocumentId] ?? [])
    : [];
  const selectedSnapshotId = activeSnapshots[0]?.id ?? null;

  return {
    documents: payload.documents,
    fragments: payload.fragments,
    recipes: payload.recipes,
    recipeItems: payload.recipeItems,
    snapshotsByDocumentId: payload.snapshotsByDocumentId,
    activeDocumentId,
    selectedSnapshotId,
  };
}
