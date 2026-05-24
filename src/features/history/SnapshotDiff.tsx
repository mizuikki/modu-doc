import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";

function diffLines(left: string, right: string) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const max = Math.max(leftLines.length, rightLines.length);
  const rows: Array<{ id: string; kind: "same" | "remove" | "add"; text: string }> = [];
  let rowId = 0;
  const nextRowId = (kind: "same" | "remove" | "add") => {
    rowId += 1;
    return `${kind}-${rowId}`;
  };

  for (let index = 0; index < max; index += 1) {
    const leftLine = leftLines[index];
    const rightLine = rightLines[index];
    if (leftLine === rightLine) {
      if (leftLine !== undefined) {
        rows.push({ id: nextRowId("same"), kind: "same", text: leftLine });
      }
      continue;
    }
    if (leftLine !== undefined) {
      rows.push({ id: nextRowId("remove"), kind: "remove", text: leftLine });
    }
    if (rightLine !== undefined) rows.push({ id: nextRowId("add"), kind: "add", text: rightLine });
  }

  return rows;
}

export function SnapshotDiff() {
  const { t } = useTranslation();
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
      .join("\n\n");
  }, [activeRecipeId, fragments, recipeItems]);

  const snapshot =
    snapshots.find((entry) => entry.id === selectedSnapshotId) ?? snapshots[0] ?? null;
  const rows = useMemo(
    () => diffLines(snapshot?.compiledText ?? "", currentText),
    [currentText, snapshot?.compiledText],
  );

  if (!snapshot) {
    return <div style={{ color: "hsl(var(--muted-foreground))" }}>{t("no_snapshots_yet")}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }} data-testid="history-diff">
      <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
        {snapshot.label ? tMaybe(t, snapshot.label) : t("restore")}
      </div>
      <div
        style={{
          border: "1px solid hsl(var(--border))",
          borderRadius: 12,
          overflow: "hidden",
          background: "hsl(var(--card))",
        }}
      >
        {rows.map((row) => (
          <pre
            key={row.id}
            data-testid={`history-diff-row-${row.id}`}
            style={{
              margin: 0,
              padding: "4px 10px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              background:
                row.kind === "add"
                  ? "rgba(16, 185, 129, 0.12)"
                  : row.kind === "remove"
                    ? "rgba(239, 68, 68, 0.12)"
                    : "transparent",
            }}
          >
            {row.kind === "add"
              ? `+ ${row.text}`
              : row.kind === "remove"
                ? `- ${row.text}`
                : `  ${row.text}`}
          </pre>
        ))}
      </div>
    </div>
  );
}
