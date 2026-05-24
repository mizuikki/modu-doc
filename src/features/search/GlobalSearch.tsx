import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchShortcut } from "@/app/hooks/useSearchShortcut";
import { searchWorkspaceContent } from "@/lib/api/search";
import type { SearchResult } from "@/lib/api/types";
import { useAppStore } from "@/store/appStore";

type UiSearchResult =
  | { kind: "workspace"; id: string; title: string; subtitle: string }
  | {
      kind: "fragment" | "recipe" | "snapshot";
      id: string;
      workspaceId: string;
      title: string;
      subtitle: string;
    };

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

  useSearchShortcut(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 520 }}>
      <input
        ref={inputRef}
        data-testid="global-search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            setActiveIndex(-1);
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
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
        }}
      />
      {query.trim() ? (
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
                }}
              >
                {t("no_results")}
              </div>
            ) : (
              <div
                role="listbox"
                aria-label={t("search_results")}
                style={{ display: "grid" }}
                data-testid="global-search-results"
              >
                {results.map((result, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
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
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
