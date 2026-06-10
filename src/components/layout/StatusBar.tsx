import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { tMaybe } from "@/i18n/tMaybe";
import { createSnapshot } from "@/lib/api/snapshots";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import {
  selectActiveDocument,
  selectActiveDocumentProcessStatus,
  selectActiveDocumentStatusMessage,
} from "@/store/selectors";
import type { DocumentSaveState } from "@/store/types";

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/u).length;
}

function formatRelativeTime(t: ReturnType<typeof useTranslation>["t"], iso: string | null): string {
  if (!iso) return t("just_now");
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t("just_now");
  const diff = Math.max(0, Date.now() - then);
  if (diff < 45_000) return t("just_now");
  if (diff < 60_000) return t("seconds_ago", { n: Math.floor(diff / 1000) });
  if (diff < 60 * 60_000) return t("minutes_ago", { n: Math.floor(diff / 60_000) });
  if (diff < 24 * 60 * 60_000) return t("hours_ago", { n: Math.floor(diff / (60 * 60_000)) });
  return t("days_ago", { n: Math.floor(diff / (24 * 60 * 60_000)) });
}

export function StatusBar() {
  const { t } = useTranslation();
  const zenMode = useAppStore((state) => state.ui.zenMode);
  const toggleZenMode = useAppStore((state) => state.toggleZenMode);
  const setZenMode = useAppStore((state) => state.setZenMode);
  const activeDocument = useAppStore(selectActiveDocument);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const processStatus = useAppStore(selectActiveDocumentProcessStatus);
  const statusMessage = useAppStore(selectActiveDocumentStatusMessage);
  const activeDocumentDraft = useAppStore((state) =>
    activeDocument ? state.documentDrafts[activeDocument.id] : undefined,
  );
  const setDocumentStatusMessage = useAppStore((state) => state.setDocumentStatusMessage);
  const fragments = useAppStore((state) => state.fragments);
  const [, force] = useState(0);

  const visibleFragments = useMemo(
    () =>
      fragments.filter(
        (fragment) => fragment.projectId === activeProjectId && fragment.deletedAt === null,
      ),
    [fragments, activeProjectId],
  );

  useEffect(() => {
    if (!activeDocument?.lastWrittenAt) return;
    const id = window.setInterval(() => force((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, [activeDocument?.lastWrittenAt]);

  const visibleContent = activeDocumentDraft ?? activeDocument?.content ?? "";
  const wordCount = countWords(visibleContent);
  const lastWrittenAt = activeDocument?.lastWrittenAt ?? null;
  const hasLocalChanges =
    activeDocumentDraft !== undefined && activeDocumentDraft !== activeDocument?.content;
  const saveState = activeDocument
    ? getVisibleSaveState(activeDocument.saveState, hasLocalChanges)
    : null;
  const canSnapshot = Boolean(activeProjectId && activeDocument);

  const handleSnapshot = async () => {
    if (!activeDocument) return;
    try {
      await createSnapshot({
        documentId: activeDocument.id,
        label: tMaybe(t, "auto_snapshot"),
      });
    } catch (error) {
      setDocumentStatusMessage(activeDocument.id, normalizeAppError(error));
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        padding: "0 var(--space-4)",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span
          data-testid="status-process"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            fontSize: 12,
            lineHeight: 1.2,
          }}
        >
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            {activeDocument
              ? documentSaveSummary(t, saveState, processStatus, lastWrittenAt)
              : t("no_project_selected")}
          </span>
        </span>
        {statusMessage ? (
          <span style={{ color: "hsl(var(--muted-foreground))" }}>{tMaybe(t, statusMessage)}</span>
        ) : activeDocument?.targetPath ? (
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            {basename(activeDocument.targetPath)}
          </span>
        ) : null}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-3)",
          color: "hsl(var(--muted-foreground))",
        }}
      >
        <span data-testid="status-word-count">
          {t("word_count")}: {wordCount.toLocaleString()}
        </span>
        <span aria-hidden style={{ opacity: 0.4 }}>
          ·
        </span>
        <span data-testid="status-fragment-count">
          {t("fragment_count", { count: visibleFragments.length })}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <button
          type="button"
          data-testid="zen-toggle"
          onClick={() => {
            if (zenMode) {
              setZenMode(false);
            } else {
              toggleZenMode();
            }
          }}
          title={`${t("zen_mode")} (${t("zen_shortcut")})`}
          aria-label={t(zenMode ? "exit_zen_mode" : "zen_mode")}
          aria-pressed={zenMode}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: zenMode ? "hsl(var(--primary))" : "hsl(var(--card))",
            color: zenMode ? "hsl(var(--primary-foreground))" : "inherit",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {t("zen_mode")}
        </button>
        <button
          type="button"
          data-testid="status-snapshot"
          disabled={!canSnapshot}
          onClick={() => void handleSnapshot()}
          aria-label={t("create_snapshot")}
          title={t("create_snapshot")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            cursor: canSnapshot ? "pointer" : "not-allowed",
            opacity: canSnapshot ? 1 : 0.5,
            fontSize: 12,
            color: "hsl(var(--foreground))",
          }}
        >
          <Plus aria-hidden size={12} strokeWidth={2} />
          {t("create_snapshot")}
        </button>
      </div>
    </div>
  );
}

function basename(path: string): string {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path;
}

function getVisibleSaveState(
  saveState: DocumentSaveState,
  hasLocalChanges: boolean,
): DocumentSaveState {
  if (hasLocalChanges && saveState === "saved") return "unsaved";
  return saveState;
}

function documentSaveSummary(
  t: ReturnType<typeof useTranslation>["t"],
  saveState: DocumentSaveState | null,
  processStatus: string,
  lastWrittenAt: string | null,
): string {
  if (processStatus === "saving") return t("saving_draft");
  if (processStatus === "writing") return t("saving_to_file");
  if (processStatus === "editing" && saveState === "draft") return t("draft_not_saved_to_file");
  if (processStatus === "editing") return t("unsaved_changes");

  switch (saveState) {
    case "draft":
      return t("draft_not_saved_to_file");
    case "unsaved":
      return t("unsaved_changes");
    case "saved":
      return lastWrittenAt
        ? t("saved_to_file_time", { time: formatRelativeTime(t, lastWrittenAt) })
        : t("saved_to_file");
    case "conflict":
      return t("file_changed_externally");
    case "error":
      return t("save_failed");
    default:
      return t("idle");
  }
}
