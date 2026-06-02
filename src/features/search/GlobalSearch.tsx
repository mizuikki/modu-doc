import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchShortcut } from "@/app/hooks/useSearchShortcut";
import { searchWorkspaceContent } from "@/lib/api/search";
import type { SearchResult } from "@/lib/api/types";
import { useAppStore } from "@/store/appStore";

type ResultKind = "workspace" | "fragment" | "recipe" | "snapshot";

type UiSearchResult =
  | { kind: "workspace"; id: string; title: string; subtitle: string }
  | {
      kind: "fragment" | "recipe" | "snapshot";
      id: string;
      workspaceId: string;
      title: string;
      subtitle: string;
    };

const GROUP_ORDER: ResultKind[] = ["fragment", "recipe", "snapshot", "workspace"];

const GROUP_LABEL_KEYS: Record<ResultKind, string> = {
  fragment: "search_group_fragments",
  recipe: "search_group_recipes",
  snapshot: "search_group_snapshots",
  workspace: "search_group_workspaces",
};

function isResultKind(value: string): value is ResultKind {
  return (
    value === "workspace" || value === "fragment" || value === "recipe" || value === "snapshot"
  );
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<UiSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const setActiveFragment = useAppStore((state) => state.setActiveFragment);
  const setActiveRecipe = useAppStore((state) => state.setActiveRecipe);
  const setActiveMainTab = useAppStore((state) => state.setActiveMainTab);
  const setSelectedSnapshot = useAppStore((state) => state.setSelectedSnapshot);

  const results = useMemo(() => remoteResults, [remoteResults]);

  const applyResult = (result: UiSearchResult) => {
    if (result.kind === "workspace") {
      setActiveWorkspace(result.id);
    } else if (result.kind === "fragment") {
      setActiveWorkspace(result.workspaceId);
      setActiveFragment(result.id);
      setActiveMainTab("edit");
    } else if (result.kind === "recipe") {
      setActiveWorkspace(result.workspaceId);
      setActiveRecipe(result.id);
      setActiveMainTab("edit");
    } else {
      setActiveWorkspace(result.workspaceId);
      setSelectedSnapshot(result.id);
      setActiveMainTab("history");
    }
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setRemoteResults([]);
      setActiveIndex(-1);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await searchWorkspaceContent(normalized, 8);
          if (cancelled) return;
          const mapped: UiSearchResult[] = raw
            .map((result: SearchResult) => {
              if (result.kind === "workspace") {
                return {
                  kind: "workspace" as const,
                  id: result.id,
                  title: result.title,
                  subtitle: result.subtitle,
                };
              }
              if (!result.workspace_id) return null;
              return {
                kind: result.kind,
                id: result.id,
                workspaceId: result.workspace_id,
                title: result.title,
                subtitle: result.subtitle || t("empty_fragment"),
              };
            })
            .filter((entry): entry is UiSearchResult => Boolean(entry));
          setRemoteResults(mapped);
        } finally {
          if (!cancelled) setIsSearching(false);
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, t]);

  useEffect(() => {
    if (results.length === 0) {
      if (activeIndex !== -1) setActiveIndex(-1);
      return;
    }
    if (activeIndex >= results.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, results.length]);

  const grouped = useMemo(() => {
    const map = new Map<ResultKind, UiSearchResult[]>();
    for (const kind of GROUP_ORDER) map.set(kind, []);
    for (const result of results) {
      if (!isResultKind(result.kind)) continue;
      map.get(result.kind)?.push(result);
    }
    return GROUP_ORDER.map((kind) => ({
      kind,
      items: map.get(kind) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [results]);

  const flatIndexById = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const group of grouped) {
      for (const item of group.items) {
        map.set(`${item.kind}-${item.id}`, index);
        index += 1;
      }
    }
    return map;
  }, [grouped]);

  const firstIndexOfGroup = useCallback(
    (kind: ResultKind): number => {
      const group = grouped.find((entry) => entry.kind === kind);
      if (!group || group.items.length === 0) return -1;
      const id = `${group.items[0].kind}-${group.items[0].id}`;
      return flatIndexById.get(id) ?? -1;
    },
    [grouped, flatIndexById],
  );

  const currentGroup = useMemo(() => {
    if (activeIndex < 0) return null;
    let index = 0;
    for (const group of grouped) {
      const nextIndex = index + group.items.length;
      if (activeIndex < nextIndex) {
        return group.kind;
      }
      index = nextIndex;
    }
    return null;
  }, [activeIndex, grouped]);

  const moveToNextGroup = () => {
    if (!currentGroup) return;
    const order = grouped.map((entry) => entry.kind);
    const idx = order.indexOf(currentGroup);
    if (idx < 0 || idx === order.length - 1) return;
    const target = firstIndexOfGroup(order[idx + 1]);
    if (target >= 0) setActiveIndex(target);
  };

  const moveToPreviousGroup = () => {
    if (!currentGroup) return;
    const order = grouped.map((entry) => entry.kind);
    const idx = order.indexOf(currentGroup);
    if (idx <= 0) return;
    const target = firstIndexOfGroup(order[idx - 1]);
    if (target >= 0) setActiveIndex(target);
  };

  useSearchShortcut(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  const hasQuery = query.trim().length > 0;
  const showHint = hasQuery && !isSearching && results.length === 0;
  const shortcutToken =
    typeof navigator === "undefined"
      ? "other"
      : /mac/i.test(navigator.platform ?? "") || /mac/i.test(navigator.userAgent ?? "")
        ? "mac"
        : "other";
  const shortcutHint = t(shortcutToken === "mac" ? "shortcut_hint_mac" : "shortcut_hint_other");

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 520 }}>
      <input
        ref={inputRef}
        data-testid="global-search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (query.trim().length > 0) {
              setQuery("");
              setActiveIndex(-1);
              return;
            }
            inputRef.current?.blur();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (results.length === 0) return;
            setActiveIndex((prev) => Math.min(results.length - 1, Math.max(0, prev + 1)));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (results.length === 0) return;
            setActiveIndex((prev) => Math.max(0, prev <= 0 ? 0 : prev - 1));
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            moveToNextGroup();
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveToPreviousGroup();
            return;
          }
          if (event.key === "Enter") {
            if (activeIndex < 0 || activeIndex >= results.length) return;
            event.preventDefault();
            applyResult(results[activeIndex]);
          }
        }}
        placeholder={t("search_placeholder")}
        aria-label={t("search")}
        style={{
          width: "100%",
          padding: "8px 56px 8px 12px",
          borderRadius: 999,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
        }}
      />
      <span
        data-testid="search-shortcut-hint"
        aria-hidden
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          padding: "2px 8px",
          fontSize: 11,
          borderRadius: 6,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--muted-foreground))",
          pointerEvents: "none",
        }}
      >
        {shortcutHint}
      </span>
      {hasQuery ? (
        <div
          data-testid="global-search-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 40,
            border: "1px solid hsl(var(--border))",
            borderRadius: 16,
            background: "hsl(var(--card))",
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
            overflow: "hidden",
          }}
        >
          <div
            style={{ padding: "10px 12px", fontSize: 12, color: "hsl(var(--muted-foreground))" }}
          >
            {t("search_results")}
            {isSearching ? "…" : ""}
          </div>
          <div style={{ display: "grid" }}>
            {results.length === 0 ? (
              <div
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div>{t("no_results")}</div>
                {showHint ? (
                  <div data-testid="search-create-hint">
                    {t("create_fragment_hint", { name: query.trim() })}
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                role="listbox"
                aria-label={t("search_results")}
                style={{ display: "grid" }}
                data-testid="global-search-results"
              >
                {grouped.map((group) => (
                  <div key={group.kind} data-testid={`search-group-${group.kind}`}>
                    <div
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "hsl(var(--muted-foreground))",
                        background: "hsl(var(--muted))",
                      }}
                    >
                      {t(GROUP_LABEL_KEYS[group.kind] as never)}
                    </div>
                    {group.items.map((result) => {
                      const key = `${result.kind}-${result.id}`;
                      const flatIndex = flatIndexById.get(key) ?? -1;
                      const isActive = flatIndex === activeIndex;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyResult(result)}
                          aria-selected={isActive}
                          role="option"
                          data-testid={`global-search-result-${result.kind}-${result.id}`}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderTop: "1px solid hsl(var(--border))",
                            background: isActive ? "hsl(var(--muted))" : "transparent",
                            width: "100%",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{result.title}</div>
                          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                            {result.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
