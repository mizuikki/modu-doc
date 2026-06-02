import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Switch from "@radix-ui/react-switch";
import type { TFunction } from "i18next";

type SortableFragmentCardProps = {
  id: string;
  name: string;
  enabled: boolean;
  active: boolean;
  t: TFunction;
  onToggle: () => void;
};

export function SortableFragmentCard({
  id,
  name,
  enabled,
  active,
  t,
  onToggle,
}: SortableFragmentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const disabledOpacity = 0.62;
  const isDisabled = !enabled;
  const dragColor = isDisabled ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))";
  return (
    <div
      ref={setNodeRef}
      data-testid={`recipe-item-${id}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        border: active ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
        borderRadius: "var(--radius-md)",
        background: isDragging
          ? "hsl(var(--muted))"
          : isDisabled
            ? "hsl(var(--muted))"
            : "hsl(var(--card))",
        padding: "var(--space-2)",
        minHeight: 40,
        opacity: enabled ? 1 : disabledOpacity,
        boxShadow: isDragging ? "0 12px 28px rgba(0, 0, 0, 0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <button
          type="button"
          aria-label="Drag fragment"
          data-testid={`recipe-item-drag-${id}`}
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-1) var(--space-2)",
            background: isDisabled ? "hsl(var(--card))" : "transparent",
            lineHeight: 1,
            color: dragColor,
            opacity: isDisabled ? 0.7 : 1,
          }}
        >
          ::
        </button>
        <strong
          style={{
            fontSize: 13,
            minWidth: 0,
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </strong>
        <Switch.Root
          checked={enabled}
          onCheckedChange={onToggle}
          data-testid={`recipe-item-toggle-${id}`}
          aria-label={enabled ? t("switch_to_disable") : t("switch_to_enable")}
          style={{
            width: 36,
            height: 20,
            background: enabled ? "hsl(var(--primary))" : "hsl(var(--muted))",
            borderRadius: 999,
            position: "relative",
            border: 0,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Switch.Thumb
            style={{
              display: "block",
              width: 16,
              height: 16,
              background: "hsl(var(--card))",
              borderRadius: 999,
              boxShadow: "var(--elevation-1)",
              transform: enabled ? "translateX(18px)" : "translateX(2px)",
              transition: "transform 120ms ease",
            }}
          />
        </Switch.Root>
      </div>
    </div>
  );
}
