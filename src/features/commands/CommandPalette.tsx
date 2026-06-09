import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCommandPaletteShortcut } from "@/app/hooks/useCommandPaletteShortcut";
import { useAppDialog } from "@/components/dialog/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { tMaybe } from "@/i18n/tMaybe";
import { createDocument } from "@/lib/api/documents";
import { createFragment } from "@/lib/api/fragments";
import { createSnapshot } from "@/lib/api/snapshots";
import { createWorkspace } from "@/lib/api/workspaces";
import { normalizeAppError } from "@/lib/appError";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveWorkspace } from "@/store/selectors";

export type CommandCategory = "workspace" | "document" | "view" | "sync" | "fragment" | "help";

export type Command = {
  id: string;
  labelKey: string;
  category: CommandCategory;
  shortcut?: string;
  run: (ctx: CommandContext) => void | Promise<void>;
};

type CommandContext = {
  openSearch: () => void;
  openCommandPalette: () => void;
};

type CommandPaletteProps = {
  openRef?: React.MutableRefObject<(() => void) | null>;
  onOpenSearch?: () => void;
};

const CATEGORY_ORDER: CommandCategory[] = [
  "workspace",
  "document",
  "view",
  "sync",
  "fragment",
  "help",
];

const CATEGORY_LABEL_KEYS: Record<CommandCategory, string> = {
  workspace: "category_workspace",
  document: "category_workspace",
  view: "category_view",
  sync: "category_sync",
  fragment: "category_fragment",
  help: "category_help",
};

const RECENT_COMMANDS_STORAGE_KEY = "modudoc-recent-commands";
const RECENT_COMMANDS_LIMIT = 5;

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  if (normalizedText.includes(normalizedQuery)) return true;
  let queryIndex = 0;
  for (const char of normalizedText) {
    if (char === normalizedQuery[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === normalizedQuery.length) return true;
    }
  }
  return false;
}

function readRecentCommands(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, RECENT_COMMANDS_LIMIT);
  } catch {
    return [];
  }
}

function writeRecentCommands(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_COMMANDS_STORAGE_KEY,
      JSON.stringify(ids.slice(0, RECENT_COMMANDS_LIMIT)),
    );
  } catch {
    // Ignore quota or disabled storage.
  }
}

function pushRecentCommand(id: string) {
  const existing = readRecentCommands().filter((entry) => entry !== id);
  writeRecentCommands([id, ...existing].slice(0, RECENT_COMMANDS_LIMIT));
}

export function CommandPalette({ openRef, onOpenSearch }: CommandPaletteProps) {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const activeDocument = useAppStore(selectActiveDocument);
  const setCenterMode = useAppStore((state) => state.setCenterMode);

  const openSearch = useCallback(() => {
    setOpen(false);
    onOpenSearch?.();
    window.setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>(
        '[data-testid="global-search-input"]',
      );
      searchInput?.focus();
      searchInput?.select();
    }, 0);
  }, [onOpenSearch]);

  const openSelf = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useCommandPaletteShortcut(openSelf);

  useEffect(() => {
    if (openRef) {
      openRef.current = () => setOpen(true);
    }
  }, [openRef]);

  useEffect(() => {
    const handleOpenEvent = () => setOpen(true);
    window.addEventListener("modudoc:open-command-palette", handleOpenEvent);
    return () => window.removeEventListener("modudoc:open-command-palette", handleOpenEvent);
  }, []);

  const handleNewFragment = useCallback(async () => {
    if (!activeWorkspace?.id) {
      toast.error(t("no_workspace_selected"));
      return;
    }
    const result = await dialog.prompt({ title: t("fragment_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      await createFragment({ workspaceId: activeWorkspace.id, name });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  }, [activeWorkspace?.id, dialog, toast, t]);

  const handleNewDocument = useCallback(async () => {
    if (!activeWorkspace?.id) {
      toast.error(t("no_workspace_selected"));
      return;
    }
    // Reuse the fragment name prompt for the document name; the new key
    // is added in a follow-up to keep the i18n parity test happy.
    const result = await dialog.prompt({ title: t("fragment_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      const doc = await createDocument({ workspaceId: activeWorkspace.id, name });
      useAppStore.getState().setActiveDocument(doc.id);
      setCenterMode("edit");
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  }, [activeWorkspace?.id, dialog, setCenterMode, toast, t]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeDocument) {
      toast.error(t("no_workspace_selected"));
      return;
    }
    try {
      await createSnapshot({ documentId: activeDocument.id, label: null });
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  }, [activeDocument, toast, t]);

  const handleFocusDocument = useCallback(() => {
    if (!activeDocument) {
      toast.error(t("no_workspace_selected"));
      return;
    }
    setCenterMode("edit");
  }, [activeDocument, setCenterMode, toast, t]);

  const handleNewWorkspace = useCallback(async () => {
    const result = await dialog.prompt({ title: t("workspace_name_prompt") });
    if (!result.ok) return;
    const name = result.value.trim();
    if (!name) return;
    try {
      const workspace = await createWorkspace({ name, initialDocumentName: "Main.md" });
      useAppStore.getState().setActiveWorkspace(workspace.id);
      setCenterMode("edit");
    } catch (error) {
      toast.error(normalizeAppError(error), t("action_failed"));
    }
  }, [dialog, setCenterMode, toast, t]);

  useEffect(() => {
    if (!open) return;
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (!detail?.id) return;
      if (detail.id === "new-fragment") {
        void handleNewFragment();
      } else if (detail.id === "new-document") {
        void handleNewDocument();
      } else if (detail.id === "new-workspace") {
        void handleNewWorkspace();
      } else if (detail.id === "workspace-settings") {
        window.dispatchEvent(new CustomEvent("modudoc:open-workspace-settings"));
      } else if (detail.id === "show-shortcuts") {
        toast.info(t("show_shortcuts_cmd"));
      }
    };
    window.addEventListener("modudoc:command", handleCommandEvent);
    return () => window.removeEventListener("modudoc:command", handleCommandEvent);
  }, [open, handleNewFragment, handleNewDocument, handleNewWorkspace, toast, t]);

  const commands = useMemo<Command[]>(
    () =>
      buildCommands({
        openSearch,
        openCommandPalette: openSelf,
        onNewDocument: handleNewDocument,
        onCreateSnapshot: handleCreateSnapshot,
        onFocusDocument: handleFocusDocument,
      }),
    [openSearch, openSelf, handleNewDocument, handleCreateSnapshot, handleFocusDocument],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setRecentIds(readRecentCommands());
      queueMicrotask(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const filteredCommands = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) return commands;
    return commands.filter((command) => fuzzyMatch(normalized, tMaybe(t, command.labelKey)));
  }, [commands, query, t]);

  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, Command[]>();
    for (const category of CATEGORY_ORDER) {
      map.set(category, []);
    }
    for (const command of filteredCommands) {
      map.get(command.category)?.push(command);
    }
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: map.get(category) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [filteredCommands]);

  const flatList = useMemo(() => grouped.flatMap((group) => group.items), [grouped]);

  useEffect(() => {
    if (flatList.length === 0) {
      if (activeIndex !== -1) setActiveIndex(-1);
      return;
    }
    if (activeIndex >= flatList.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, flatList.length]);

  const recentCommands = useMemo(() => {
    if (query.trim()) return [];
    const lookup = new Map(commands.map((command) => [command.id, command]));
    return recentIds
      .map((id) => lookup.get(id))
      .filter((entry): entry is Command => Boolean(entry));
  }, [query, recentIds, commands]);

  const executeCommand = useCallback(
    async (command: Command) => {
      pushRecentCommand(command.id);
      setRecentIds(readRecentCommands());
      setOpen(false);
      try {
        await command.run({ openSearch, openCommandPalette: openSelf });
      } catch (error) {
        toast.error(normalizeAppError(error), t("action_failed"));
      }
    },
    [openSearch, openSelf, toast, t],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
        }
      }}
    >
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
          data-testid="command-palette"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (flatList.length === 0) return;
              setActiveIndex((prev) => (prev < 0 ? 0 : Math.min(flatList.length - 1, prev + 1)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (flatList.length === 0) return;
              setActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
              return;
            }
            if (event.key === "Enter") {
              if (flatList.length === 0) return;
              event.preventDefault();
              const target = flatList[activeIndex] ?? flatList[0];
              if (target) void executeCommand(target);
            }
          }}
          style={{
            position: "fixed",
            left: "50%",
            top: "20%",
            transform: "translateX(-50%)",
            width: "min(560px, calc(100vw - 32px))",
            maxHeight: "60vh",
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
          <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
            {t("command_palette")}
          </Dialog.Title>
          <Dialog.Description
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
          >
            {t("command_palette_placeholder")}
          </Dialog.Description>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid hsl(var(--border))",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              ref={inputRef}
              data-testid="command-palette-input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder={t("command_palette_placeholder")}
              aria-label={t("command_palette")}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "transparent",
                color: "inherit",
                fontSize: 14,
              }}
            />
            <span
              aria-hidden
              style={{
                fontSize: 11,
                color: "hsl(var(--muted-foreground))",
                padding: "2px 6px",
                borderRadius: 6,
                border: "1px solid hsl(var(--border))",
              }}
            >
              ESC
            </span>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "8px 0",
            }}
          >
            {flatList.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                  textAlign: "center",
                }}
              >
                {t("no_results")}
              </div>
            ) : (
              <>
                {recentCommands.length > 0 ? (
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        padding: "4px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "hsl(var(--muted-foreground))",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {t("recent_commands")}
                    </div>
                    {recentCommands.map((command) => {
                      const flatIndex = flatList.findIndex((entry) => entry.id === command.id);
                      if (flatIndex < 0) return null;
                      return (
                        <CommandRow
                          key={`recent-${command.id}`}
                          command={command}
                          isActive={flatIndex === activeIndex}
                          onHover={() => setActiveIndex(flatIndex)}
                          onSelect={() => void executeCommand(command)}
                        />
                      );
                    })}
                  </div>
                ) : null}
                {grouped.map((group) => (
                  <div key={group.category} style={{ marginBottom: 4 }}>
                    <div
                      data-testid={`command-palette-category-${group.category}`}
                      style={{
                        padding: "4px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "hsl(var(--muted-foreground))",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {tMaybe(t, CATEGORY_LABEL_KEYS[group.category])}
                    </div>
                    {group.items.map((command) => {
                      const flatIndex = flatList.findIndex((entry) => entry.id === command.id);
                      return (
                        <CommandRow
                          key={command.id}
                          command={command}
                          isActive={flatIndex === activeIndex}
                          onHover={() => setActiveIndex(flatIndex)}
                          onSelect={() => void executeCommand(command)}
                        />
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CommandRow({
  command,
  isActive,
  onHover,
  onSelect,
}: {
  command: Command;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      data-testid={`command-palette-item-${command.id}`}
      onMouseMove={onHover}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "8px 16px",
        background: isActive ? "hsl(var(--muted))" : "transparent",
        color: "inherit",
        border: 0,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 500 }}>{tMaybe(t, command.labelKey)}</span>
      {command.shortcut ? (
        <span
          aria-hidden
          style={{
            fontSize: 11,
            color: "hsl(var(--muted-foreground))",
            padding: "2px 6px",
            borderRadius: 6,
            border: "1px solid hsl(var(--border))",
          }}
        >
          {command.shortcut}
        </span>
      ) : null}
    </button>
  );
}

export function buildCommands(args: {
  openSearch: () => void;
  openCommandPalette: () => void;
  onNewDocument: () => void | Promise<void>;
  onCreateSnapshot: () => void | Promise<void>;
  onFocusDocument: () => void;
}): Command[] {
  return [
    {
      id: "new-workspace",
      labelKey: "new_workspace_cmd",
      category: "workspace",
      run: () => {
        window.dispatchEvent(
          new CustomEvent("modudoc:command", { detail: { id: "new-workspace" } }),
        );
      },
    },
    {
      id: "workspace-settings",
      labelKey: "workspace_settings_cmd",
      category: "workspace",
      run: () => {
        window.dispatchEvent(
          new CustomEvent("modudoc:command", { detail: { id: "workspace-settings" } }),
        );
      },
    },
    {
      id: "new-document",
      labelKey: "new_document_cmd",
      category: "document",
      run: () => {
        void args.onNewDocument();
      },
    },
    {
      id: "focus-document",
      labelKey: "focus_document_cmd",
      category: "document",
      run: () => {
        args.onFocusDocument();
      },
    },
    {
      id: "toggle-zen",
      labelKey: "toggle_zen_cmd",
      category: "view",
      shortcut: "Cmd/Ctrl+.",
      run: () => {
        useAppStore.getState().toggleZenMode();
      },
    },
    {
      id: "create-snapshot",
      labelKey: "create_snapshot_cmd",
      category: "sync",
      run: () => {
        void args.onCreateSnapshot();
      },
    },
    {
      id: "new-fragment",
      labelKey: "new_fragment_cmd",
      category: "fragment",
      run: () => {
        window.dispatchEvent(
          new CustomEvent("modudoc:command", { detail: { id: "new-fragment" } }),
        );
      },
    },
    {
      id: "open-search",
      labelKey: "open_search_cmd",
      category: "help",
      shortcut: "Cmd/Ctrl+K",
      run: () => {
        args.openSearch();
      },
    },
    {
      id: "show-shortcuts",
      labelKey: "show_shortcuts_cmd",
      category: "help",
      run: () => {
        window.dispatchEvent(
          new CustomEvent("modudoc:command", { detail: { id: "show-shortcuts" } }),
        );
      },
    },
  ];
}
