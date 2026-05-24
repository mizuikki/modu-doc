import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { tMaybe } from "@/i18n/tMaybe";

type ToastVariant = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
      error: (message, title) => pushToast({ variant: "error", message, title }),
      info: (message, title) => pushToast({ variant: "info", message, title }),
      success: (message, title) => pushToast({ variant: "success", message, title }),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 60,
          display: "grid",
          gap: 8,
          width: "min(420px, calc(100vw - 32px))",
        }}
        aria-live="polite"
        aria-relevant="additions"
        data-testid="toast-stack"
      >
        {toasts.map((toast) => {
          const borderColor =
            toast.variant === "error"
              ? "hsl(8 84% 60%)"
              : toast.variant === "success"
                ? "hsl(157 62% 42%)"
                : "hsl(var(--border))";
          const background =
            toast.variant === "error"
              ? "hsl(8 100% 97%)"
              : toast.variant === "success"
                ? "hsl(157 62% 94%)"
                : "hsl(var(--card))";
          const color =
            toast.variant === "error"
              ? "hsl(8 50% 25%)"
              : toast.variant === "success"
                ? "hsl(157 50% 20%)"
                : "hsl(var(--foreground))";
          return (
            <div
              key={toast.id}
              data-testid={`toast-${toast.variant}`}
              style={{
                border: `1px solid ${borderColor}`,
                background,
                color,
                borderRadius: 14,
                padding: "10px 12px",
                boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  {toast.title ? <div style={{ fontWeight: 600 }}>{toast.title}</div> : null}
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {tMaybe(t, toast.message)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                  aria-label={t("close")}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "inherit",
                    padding: 0,
                    lineHeight: 1,
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
