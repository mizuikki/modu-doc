import { useRef, useState } from "react";

type ColumnSplitterProps = {
  onResize: (deltaPx: number) => void;
  minPx?: number;
  maxPx?: number;
  currentPx: number;
  ariaLabel: string;
  className?: string;
  testId?: string;
};

export function ColumnSplitter({
  onResize,
  minPx = 160,
  maxPx = 480,
  currentPx,
  ariaLabel,
  className,
  testId,
}: ColumnSplitterProps) {
  const dragRef = useRef<{ pointerId: number; startX: number; startPx: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPx: currentPx,
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    const next = Math.min(maxPx, Math.max(minPx, drag.startPx + delta));
    onResize(next);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      data-testid={testId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onResize(Math.max(minPx, currentPx - 16));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onResize(Math.min(maxPx, currentPx + 16));
        }
        if (event.key === "Home") {
          event.preventDefault();
          onResize(minPx);
        }
        if (event.key === "End") {
          event.preventDefault();
          onResize(maxPx);
        }
      }}
      onDoubleClick={() => onResize((minPx + maxPx) / 2)}
      style={{
        width: 10,
        border: 0,
        background: "transparent",
        cursor: "col-resize",
        display: "grid",
        placeItems: "center",
        color: "hsl(var(--muted-foreground))",
        padding: 0,
        touchAction: "none",
        userSelect: isResizing ? "none" : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 2,
          height: "100%",
          borderRadius: 999,
          background: "currentColor",
          opacity: 0.7,
        }}
      />
    </button>
  );
}
