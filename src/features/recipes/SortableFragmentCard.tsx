import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TFunction } from "i18next";

type SortableFragmentCardProps = {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  active: boolean;
  t: TFunction;
  onToggle: () => void;
};

export function SortableFragmentCard({
  id,
  name,
  content,
  enabled,
  active,
  t,
  onToggle,
}: SortableFragmentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`recipe-item-${id}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        border: active ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
        borderRadius: 14,
        background: isDragging ? "hsl(var(--muted))" : "hsl(var(--card))",
        padding: 12,
        opacity: enabled ? 1 : 0.62,
        boxShadow: isDragging ? "0 12px 28px rgba(0, 0, 0, 0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button
          type="button"
          aria-label="Drag fragment"
          data-testid={`recipe-item-drag-${id}`}
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            padding: "6px 8px",
            background: "transparent",
            lineHeight: 1,
          }}
        >
          ::
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "space-between",
            }}
          >
            <strong style={{ fontSize: 14 }}>{name}</strong>
            <button
              type="button"
              onClick={onToggle}
              data-testid={`recipe-item-toggle-${id}`}
              style={{
                border: "1px solid hsl(var(--border))",
                borderRadius: 999,
                padding: "4px 10px",
                background: enabled ? "hsl(var(--primary))" : "transparent",
                color: enabled ? "hsl(var(--primary-foreground))" : "inherit",
              }}
            >
              {enabled ? t("disable") : t("enable")}
            </button>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {content || t("empty_fragment")}
          </div>
        </div>
      </div>
    </div>
  );
}
