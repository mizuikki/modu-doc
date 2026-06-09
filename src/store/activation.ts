import type { DocumentSummary } from "./types";

export function pickFirstVisibleDocument(
  documents: DocumentSummary[],
  preferredId?: string | null,
): DocumentSummary | null {
  const preferred = documents.find((d) => d.id === preferredId && d.deletedAt === null);
  if (preferred) return preferred;
  return documents.find((d) => d.deletedAt === null) ?? null;
}

export function isDocumentVisible(d: DocumentSummary): boolean {
  return d.deletedAt === null;
}
