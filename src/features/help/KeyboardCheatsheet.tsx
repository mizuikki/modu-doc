import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCheatsheetShortcut } from "@/app/hooks/useCheatsheetShortcut";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";

type ShortcutRow = {
  id: string;
  labelKey: string;
  macKeys: ReactNode;
  otherKeys: ReactNode;
};

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        padding: "2px 6px",
        borderRadius: 6,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--muted))",
        color: "hsl(var(--foreground))",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 11,
        lineHeight: 1.4,
      }}
    >
      {children}
    </kbd>
  );
}

function joinKeys(parts: string[]): ReactNode {
  return parts.map((part, index) => (
    <span key={part} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {index > 0 ? (
        <span aria-hidden style={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}>
          +
        </span>
      ) : null}
      <Kbd>{part}</Kbd>
    </span>
  ));
}

const ROWS: ShortcutRow[] = [
  {
    id: "search",
    labelKey: "shortcut_search",
    macKeys: joinKeys(["⌘", "K"]),
    otherKeys: joinKeys(["Ctrl", "K"]),
  },
  {
    id: "save",
    labelKey: "shortcut_save",
    macKeys: joinKeys(["⌘", "S"]),
    otherKeys: joinKeys(["Ctrl", "S"]),
  },
  {
    id: "snapshot",
    labelKey: "shortcut_snapshot",
    macKeys: joinKeys(["⌘", "⏎"]),
    otherKeys: joinKeys(["Ctrl", "Enter"]),
  },
  {
    id: "zen",
    labelKey: "shortcut_zen",
    macKeys: joinKeys(["⌘", "."]),
    otherKeys: joinKeys(["Ctrl", "."]),
  },
  {
    id: "palette",
    labelKey: "shortcut_palette",
    macKeys: joinKeys(["⌘", "⇧", "P"]),
    otherKeys: joinKeys(["Ctrl", "Shift", "P"]),
  },
  {
    id: "cheatsheet",
    labelKey: "shortcut_cheatsheet",
    macKeys: joinKeys(["?"]),
    otherKeys: joinKeys(["?"]),
  },
  {
    id: "escape",
    labelKey: "shortcut_escape",
    macKeys: joinKeys(["Esc"]),
    otherKeys: joinKeys(["Esc"]),
  },
  {
    id: "navigate",
    labelKey: "shortcut_navigate",
    macKeys: joinKeys(["↑", "↓"]),
    otherKeys: joinKeys(["↑", "↓"]),
  },
  {
    id: "switch-fragment",
    labelKey: "shortcut_switch_fragment",
    macKeys: joinKeys(["⌥", "↑", "↓"]),
    otherKeys: joinKeys(["Alt", "↑", "↓"]),
  },
];

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform ?? "") || /mac/i.test(navigator.userAgent ?? "");
}

export function KeyboardCheatsheet() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.ui.cheatsheetOpen);
  const setOpen = useAppStore((state) => state.setCheatsheetOpen);

  useCheatsheetShortcut();

  const macPlatform = isMacPlatform();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.42)",
            backdropFilter: "blur(4px)",
            zIndex: 70,
          }}
        />
        <Dialog.Content
          data-testid="keyboard-cheatsheet"
          aria-label={t("keyboard_shortcuts")}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(520px, calc(100vw - 32px))",
            maxHeight: "80vh",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 16,
            boxShadow: "0 24px 72px rgba(15, 23, 42, 0.22)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 71,
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid hsl(var(--border))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Dialog.Title style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              {t("keyboard_shortcuts")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="keyboard-cheatsheet-close"
                aria-label={t("close")}
                style={{
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 11,
                  color: "hsl(var(--muted-foreground))",
                  cursor: "pointer",
                }}
              >
                Esc
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
          >
            {t("keyboard_shortcuts")}
          </Dialog.Description>
          <div
            data-testid="keyboard-cheatsheet-list"
            style={{
              padding: "8px 8px",
              overflowY: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.id} data-testid={`keyboard-cheatsheet-row-${row.id}`}>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "hsl(var(--foreground))",
                        verticalAlign: "middle",
                      }}
                    >
                      {tMaybe(t, row.labelKey)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {macPlatform ? row.macKeys : row.otherKeys}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function KeyboardCheatsheetTrigger() {
  const { t } = useTranslation();
  const setOpen = useAppStore((state) => state.setCheatsheetOpen);
  return (
    <button
      type="button"
      data-testid="keyboard-cheatsheet-trigger"
      aria-label={t("keyboard_shortcuts")}
      title={t("keyboard_shortcuts")}
      onClick={() => setOpen(true)}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      ?
    </button>
  );
}
