import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Switch from "@radix-ui/react-switch";
import type { TFunction } from "i18next";
import { Trash2 } from "lucide-react";

type SortableFragmentCardProps = {
  id: string;
  name: string;
  summary: string;
  enabled: boolean;
  active: boolean;
  selected: boolean;
  t: TFunction;
  onRemove: () => void;
  onSelect: () => void;
  onToggle: () => void;
};

export function SortableFragmentCard({
  id,
  name,
  summary,
  enabled,
  active,
  selected,
  t,
  onRemove,
  onSelect,
  onToggle,
}: SortableFragmentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const isDisabled = !enabled;
  const dragColor = isDisabled ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))";
  const isHighlighted = active || selected;

  return (
    <div
      ref={setNodeRef}
      data-testid={`recipe-item-${id}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        border: isHighlighted ? "1px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
        borderRadius: 14,
        background: isDragging
          ? "color-mix(in srgb, hsl(var(--primary)) 8%, hsl(var(--card)))"
          : isHighlighted
            ? "color-mix(in srgb, hsl(var(--primary)) 6%, hsl(var(--card)))"
            : "hsl(var(--card))",
        padding: 8,
        minHeight: 0,
        opacity: enabled ? 1 : 0.72,
        boxShadow: isDragging
          ? "0 14px 30px rgba(15, 23, 42, 0.16)"
          : selected
            ? "var(--elevation-1)"
            : "none",
      }}
    >
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
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
              padding: "5px 7px",
              background: isDisabled ? "hsl(var(--card))" : "transparent",
              lineHeight: 1,
              color: dragColor,
              opacity: isDisabled ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            ::
          </button>
          <div
            style={{
              minWidth: 0,
              flex: 1,
              display: "grid",
              gap: 3,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={onSelect}
                data-testid={`recipe-item-select-${id}`}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  color: "inherit",
                  textAlign: "left",
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <strong
                  style={{
                    fontSize: 14,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {name}
                </strong>
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label={t("remove_from_recipe")}
                title={t("remove_from_recipe")}
                data-testid={`recipe-item-remove-${id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  background: "transparent",
                  padding: 0,
                  color: "hsl(var(--muted-foreground))",
                  cursor: "pointer",
                  flexShrink: 0,
                  marginRight: 4,
                }}
              >
                <Trash2 size={14} strokeWidth={1.8} aria-hidden />
              </button>
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
            <div
              style={{
                fontSize: 11,
                color: "hsl(var(--muted-foreground))",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.3,
              }}
            >
              {summary}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
