import { isDocumentVisible } from "./activation";
import type { AppState, DocumentSummary, SnapshotSummary } from "./types";

export function selectActiveProject(state: AppState) {
  return state.projects.find((w) => w.id === state.activeProjectId) ?? null;
}

export function selectActiveDocument(state: AppState): DocumentSummary | null {
  if (!state.activeDocumentId) return null;
  return state.documents.find((d) => d.id === state.activeDocumentId) ?? null;
}

export function selectVisibleDocuments(state: AppState): DocumentSummary[] {
  return state.documents.filter(isDocumentVisible);
}

export function selectVisibleFragments(state: AppState) {
  return state.fragments.filter((f) => f.deletedAt === null);
}

export function selectActiveDocumentSnapshots(state: AppState): SnapshotSummary[] {
  if (!state.activeDocumentId) return [];
  return state.snapshotsByDocumentId[state.activeDocumentId] ?? [];
}

export function selectActiveDocumentDraft(state: AppState): string | null {
  if (!state.activeDocumentId) return null;
  const draft = state.documentDrafts[state.activeDocumentId];
  if (draft !== undefined) return draft;
  const doc = selectActiveDocument(state);
  return doc ? doc.content : null;
}

export function selectActiveDocumentProcessStatus(state: AppState) {
  if (!state.activeDocumentId) return "idle" as const;
  return state.documentProcessStatus[state.activeDocumentId] ?? "idle";
}

export function selectActiveDocumentStatusMessage(state: AppState): string | null {
  if (!state.activeDocumentId) return null;
  return state.documentStatusMessage[state.activeDocumentId] ?? null;
}
