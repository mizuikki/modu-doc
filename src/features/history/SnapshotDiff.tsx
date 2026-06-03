import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { restoreSnapshot } from "@/lib/api/snapshots";
import { normalizeAppError } from "@/lib/appError";
import { logDebugPerf } from "@/lib/debugPerf";
import { useAppStore } from "@/store/appStore";

type RowKind = "same" | "remove" | "add";

type DiffRow = {
  id: string;
  kind: RowKind;
  leftText: string | null;
  rightText: string | null;
  leftLineNumber: number | null;
  rightLineNumber: number | null;
};

type Segment = {
  id: string;
  index: number;
  rows: DiffRow[];
  hasLeft: boolean;
  hasRight: boolean;
};

const SEPARATOR_PATTERN = /\n[ \t]*---{3,}[ \t]*\n/g;

function splitSegments(text: string): string[] {
  if (!text) return [""];
  return text.split(SEPARATOR_PATTERN);
}

function diffSegment(left: string, right: string, segmentId: string): DiffRow[] {
  const leftLines = left.length > 0 ? left.split("\n") : [];
  const rightLines = right.length > 0 ? right.split("\n") : [];
  const max = Math.max(leftLines.length, rightLines.length);
  const rows: DiffRow[] = [];
  let leftNum = 0;
  let rightNum = 0;
  let counter = 0;

  for (let index = 0; index < max; index += 1) {
    const leftLine = leftLines[index];
    const rightLine = rightLines[index];
    if (leftLine === rightLine) {
      if (leftLine !== undefined) {
        leftNum += 1;
        rightNum += 1;
        counter += 1;
        rows.push({
          id: `${segmentId}-row-${counter}`,
          kind: "same",
          leftText: leftLine,
          rightText: rightLine,
          leftLineNumber: leftNum,
          rightLineNumber: rightNum,
        });
      }
      continue;
    }
    if (leftLine !== undefined) {
      leftNum += 1;
      counter += 1;
      rows.push({
        id: `${segmentId}-row-${counter}`,
        kind: "remove",
        leftText: leftLine,
        rightText: null,
        leftLineNumber: leftNum,
        rightLineNumber: null,
      });
    }
    if (rightLine !== undefined) {
      rightNum += 1;
      counter += 1;
      rows.push({
        id: `${segmentId}-row-${counter}`,
        kind: "add",
        leftText: null,
        rightText: rightLine,
        leftLineNumber: null,
        rightLineNumber: rightNum,
      });
    }
  }

  return rows;
}

function buildSegments(leftText: string, rightText: string): Segment[] {
  const leftSegs = splitSegments(leftText);
  const rightSegs = splitSegments(rightText);
  const max = Math.max(leftSegs.length, rightSegs.length);
  const segments: Segment[] = [];
  for (let i = 0; i < max; i += 1) {
    const left = leftSegs[i] ?? "";
    const right = rightSegs[i] ?? "";
    const id = `segment-${i}`;
    segments.push({
      id,
      index: i,
      hasLeft: left.length > 0,
      hasRight: right.length > 0,
      rows: diffSegment(left, right, id),
    });
  }
  return segments;
}

export function SnapshotDiff() {
  const { t } = useTranslation();
  const toast = useToast();
  const snapshots = useAppStore((state) => state.snapshots);
  const selectedSnapshotId = useAppStore((state) => state.selectedSnapshotId);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);

  const currentText = useMemo(() => {
    const activeFragments = fragments.filter((fragment) => fragment.deletedAt === null);
    const activeFragmentIds = new Set(activeFragments.map((fragment) => fragment.id));
    const orderedItems = recipeItems
      .filter((item) => item.recipeId === activeRecipeId && item.enabled)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return orderedItems
      .filter((item) => activeFragmentIds.has(item.fragmentId))
      .map(
        (item) =>
          activeFragments.find((fragment) => fragment.id === item.fragmentId)?.content ?? "",
      )
      .join("\n\n---\n\n");
  }, [activeRecipeId, fragments, recipeItems]);

  const snapshot =
    snapshots.find((entry) => entry.id === selectedSnapshotId) ?? snapshots[0] ?? null;

  const segments = useMemo(
    () => buildSegments(snapshot?.compiledText ?? "", currentText),
    [currentText, snapshot?.compiledText],
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    void logDebugPerf("main-tab ready:history", {
      snapshotId: snapshot.id,
      compiledBytes: snapshot.compiledText.length,
      segmentCount: segments.length,
    });
  }, [segments.length, snapshot]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggleSegment = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allCollapsed = segments.length > 0 && segments.every((seg) => collapsed.has(seg.id));
  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(segments.map((seg) => seg.id)));
    }
  };

  const handleCopy = async () => {
    if (!snapshot) return;
    const text = snapshot.compiledText;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(t("copy_success"));
    } catch (error) {
      toast.error(normalizeAppError(error), t("copy_failed"));
    }
  };

  const handleRestore = async () => {
    if (!snapshot) return;
    try {
      await restoreSnapshot(snapshot.id);
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  };

  if (!snapshot) {
    return <div style={{ color: "hsl(var(--muted-foreground))" }}>{t("no_snapshots_yet")}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }} data-testid="history-diff">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          {snapshot.label ? tMaybe(t, snapshot.label) : t("restore")}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={toggleAll}
            data-testid="history-diff-toggle-all"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {allCollapsed ? t("expand_all") : t("collapse_all")}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            data-testid="history-copy-compiled"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
            }}
          >
            {t("copy_compiled_text")}
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid hsl(var(--border))",
          borderRadius: 12,
          overflow: "hidden",
          background: "hsl(var(--card))",
        }}
      >
        {segments.length === 0 ? (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
              textAlign: "center",
            }}
          >
            {t("no_snapshots_yet")}
          </div>
        ) : (
          segments.map((segment, segIdx) => {
            const isCollapsed = collapsed.has(segment.id);
            return (
              <div
                key={segment.id}
                data-testid={`history-diff-segment-${segment.id}`}
                style={{
                  borderTop: segIdx === 0 ? "0" : "1px solid hsl(var(--border))",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleSegment(segment.id)}
                  data-testid={`history-diff-segment-toggle-${segment.id}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "hsl(var(--card))",
                    border: 0,
                    borderBottom: isCollapsed ? 0 : "1px solid hsl(var(--border))",
                    color: "hsl(var(--muted-foreground))",
                    fontSize: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span>
                    {isCollapsed ? "▸" : "▾"} {t("fragments")} {segment.index + 1}
                  </span>
                  <span style={{ fontSize: 11 }}>
                    {segment.rows.filter((row) => row.kind !== "same").length} changes
                  </span>
                </button>
                {isCollapsed ? null : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 12,
                      tableLayout: "fixed",
                    }}
                  >
                    <colgroup>
                      <col style={{ width: 44 }} />
                      <col />
                      <col style={{ width: 44 }} />
                      <col />
                    </colgroup>
                    <tbody>
                      {segment.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              padding: "8px 10px",
                              color: "hsl(var(--muted-foreground))",
                              fontStyle: "italic",
                            }}
                          >
                            (empty)
                          </td>
                        </tr>
                      ) : (
                        segment.rows.map((row) => (
                          <tr
                            key={row.id}
                            data-testid={`history-diff-row-${row.id}`}
                            style={{
                              background:
                                row.kind === "add"
                                  ? "var(--diff-add)"
                                  : row.kind === "remove"
                                    ? "var(--diff-remove)"
                                    : "transparent",
                            }}
                          >
                            <td
                              style={{
                                padding: "2px 6px",
                                color: "hsl(var(--muted-foreground))",
                                textAlign: "right",
                                userSelect: "none",
                                borderRight: "1px solid hsl(var(--border))",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.leftLineNumber ?? ""}
                            </td>
                            <td
                              style={{
                                padding: "2px 10px",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                borderRight: "1px solid hsl(var(--border))",
                              }}
                            >
                              {row.kind === "remove"
                                ? `- ${row.leftText ?? ""}`
                                : (row.leftText ?? "")}
                            </td>
                            <td
                              style={{
                                padding: "2px 6px",
                                color: "hsl(var(--muted-foreground))",
                                textAlign: "right",
                                userSelect: "none",
                                borderRight: "1px solid hsl(var(--border))",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.rightLineNumber ?? ""}
                            </td>
                            <td
                              style={{
                                padding: "2px 10px",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {row.kind === "add"
                                ? `+ ${row.rightText ?? ""}`
                                : (row.rightText ?? "")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => {
            void handleRestore();
          }}
          data-testid="history-restore-snapshot"
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "1px solid hsl(var(--primary))",
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {t("restore_snapshot")}
        </button>
      </div>
    </div>
  );
}
