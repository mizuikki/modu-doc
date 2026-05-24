import * as Dialog from "@radix-ui/react-dialog";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

type PromptResult = { ok: true; value: string } | { ok: false };

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
};

type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<PromptResult>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const promptInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, options: null, resolve: null });

  const [promptState, setPromptState] = useState<{
    open: boolean;
    options: PromptOptions | null;
    value: string;
    resolve: ((value: PromptResult) => void) | null;
  }>({ open: false, options: null, value: "", resolve: null });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<PromptResult>((resolve) => {
      setPromptState({
        open: true,
        options,
        value: options.defaultValue ?? "",
        resolve,
      });
    });
  }, []);

  const value = useMemo<DialogContextValue>(() => ({ confirm, prompt }), [confirm, prompt]);

  useEffect(() => {
    if (promptState.open) {
      queueMicrotask(() => {
        promptInputRef.current?.focus();
        promptInputRef.current?.select();
      });
    }
  }, [promptState.open]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Dialog.Root
        open={confirmState.open}
        onOpenChange={(open) => {
          if (open) return;
          confirmState.resolve?.(false);
          setConfirmState({ open: false, options: null, resolve: null });
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.42)",
              backdropFilter: "blur(4px)",
            }}
          />
          <Dialog.Content
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmState.resolve?.(true);
                setConfirmState({ open: false, options: null, resolve: null });
              }
              if (event.key === "Escape") {
                event.preventDefault();
                confirmState.resolve?.(false);
                setConfirmState({ open: false, options: null, resolve: null });
              }
            }}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(520px, calc(100vw - 32px))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 24px 72px rgba(15, 23, 42, 0.22)",
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <Dialog.Title style={{ margin: 0, fontSize: 18 }}>
                {confirmState.options?.title ?? ""}
              </Dialog.Title>
              {confirmState.options?.description ? (
                <Dialog.Description style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
                  {confirmState.options.description}
                </Dialog.Description>
              ) : null}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                data-testid="app-dialog-cancel"
                onClick={() => {
                  confirmState.resolve?.(false);
                  setConfirmState({ open: false, options: null, resolve: null });
                }}
              >
                {confirmState.options?.cancelText ?? t("cancel")}
              </button>
              <button
                type="button"
                data-testid="app-dialog-confirm"
                onClick={() => {
                  confirmState.resolve?.(true);
                  setConfirmState({ open: false, options: null, resolve: null });
                }}
                style={
                  confirmState.options?.danger
                    ? { borderColor: "hsl(8 84% 60%)", color: "hsl(8 84% 40%)" }
                    : undefined
                }
              >
                {confirmState.options?.confirmText ?? t("confirm")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={promptState.open}
        onOpenChange={(open) => {
          if (open) return;
          promptState.resolve?.({ ok: false });
          setPromptState({ open: false, options: null, value: "", resolve: null });
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.42)",
              backdropFilter: "blur(4px)",
            }}
          />
          <Dialog.Content
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(520px, calc(100vw - 32px))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 24px 72px rgba(15, 23, 42, 0.22)",
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <Dialog.Title style={{ margin: 0, fontSize: 18 }}>
                {promptState.options?.title ?? ""}
              </Dialog.Title>
              {promptState.options?.description ? (
                <Dialog.Description style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
                  {promptState.options.description}
                </Dialog.Description>
              ) : null}
            </div>
            <input
              value={promptState.value}
              placeholder={promptState.options?.placeholder}
              data-testid="app-prompt-input"
              ref={promptInputRef}
              onChange={(event) =>
                setPromptState((prev) => ({
                  ...prev,
                  value: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const value = promptState.value.trim();
                  promptState.resolve?.({ ok: true, value });
                  setPromptState({ open: false, options: null, value: "", resolve: null });
                }
              }}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                background: "transparent",
                color: "inherit",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                data-testid="app-dialog-cancel"
                onClick={() => {
                  promptState.resolve?.({ ok: false });
                  setPromptState({ open: false, options: null, value: "", resolve: null });
                }}
              >
                {promptState.options?.cancelText ?? t("cancel")}
              </button>
              <button
                type="button"
                data-testid="app-dialog-confirm"
                onClick={() => {
                  const value = promptState.value.trim();
                  promptState.resolve?.({ ok: true, value });
                  setPromptState({ open: false, options: null, value: "", resolve: null });
                }}
              >
                {promptState.options?.confirmText ?? t("confirm")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used within DialogProvider");
  }
  return context;
}
