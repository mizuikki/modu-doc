import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SyncStatusBadge } from "@/features/sync/SyncStatusBadge";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

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
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const createSnapshot = useAppStore((state) => state.createSnapshot);
  const [, force] = useState(0);

  useEffect(() => {
    if (!activeWorkspace?.lastCompiledAt) return;
    const id = window.setInterval(() => force((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, [activeWorkspace?.lastCompiledAt]);

  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const visibleFragments = fragments.filter(
    (fragment) => fragment.workspaceId === activeWorkspaceId && fragment.deletedAt === null,
  );
  const wordCount = visibleFragments.reduce(
    (total, fragment) => total + countWords(fragment.content),
    0,
  );
  const recipeItemCount = recipeItems.filter((item) => item.recipeId === activeRecipeId).length;
  const enabledCount = recipeItems.filter(
    (item) => item.recipeId === activeRecipeId && item.enabled,
  ).length;

  const handleSnapshot = () => {
    if (!activeWorkspaceId) return;
    createSnapshot(tMaybe(t, "auto_snapshot"));
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
        <SyncStatusBadge />
        {activeWorkspace ? (
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("last_compiled", {
              time: formatRelativeTime(t, activeWorkspace.lastCompiledAt),
            })}
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
        <span aria-hidden style={{ opacity: 0.4 }}>
          ·
        </span>
        <span data-testid="status-enabled-count">
          {t("enabled_count", { enabled: enabledCount, total: recipeItemCount })}
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
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: zenMode ? "hsl(var(--primary))" : "hsl(var(--card))",
            color: zenMode ? "hsl(var(--primary-foreground))" : "inherit",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {zenMode ? "⤡" : "⤢"} {t("zen_mode")}
        </button>
        <button
          type="button"
          data-testid="status-snapshot"
          disabled={!activeWorkspaceId}
          onClick={handleSnapshot}
          aria-label={t("create_snapshot")}
          title={t("create_snapshot")}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            cursor: activeWorkspaceId ? "pointer" : "not-allowed",
            opacity: activeWorkspaceId ? 1 : 0.5,
            fontSize: 12,
          }}
        >
          ⏱ {t("create_snapshot")}
        </button>
      </div>
    </div>
  );
}
