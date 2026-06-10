import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import brandLogo from "@/assets/modudoc-logo.png";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { GlobalSearch } from "@/features/search/GlobalSearch";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveDocumentStatusMessage } from "@/store/selectors";

type ThemeMode = "light" | "dark" | "system";

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  icon: typeof Sun;
  iconTestId: string;
}> = [
  { value: "light", icon: Sun, iconTestId: "header-theme-icon-sun" },
  { value: "system", icon: Monitor, iconTestId: "header-theme-icon-monitor" },
  { value: "dark", icon: Moon, iconTestId: "header-theme-icon-moon" },
];

export function Header() {
  const { t, i18n } = useTranslation();
  const message = useAppStore(selectActiveDocumentStatusMessage);
  const setDocumentStatusMessage = useAppStore((state) => state.setDocumentStatusMessage);
  const theme = useAppStore((state) => state.ui.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setSettingsDialogOpen = useAppStore((state) => state.setSettingsDialogOpen);
  const activeProject = useAppStore(
    (s) => s.projects.find((w) => w.id === s.activeProjectId) ?? null,
  );
  const activeDocument = useAppStore(selectActiveDocument);
  const activeDocumentId = useAppStore((state) => state.activeDocumentId);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const activeOption = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const ActiveIcon = activeOption.icon;
  const themeLabel =
    theme === "light" ? t("theme_light") : theme === "dark" ? t("theme_dark") : t("theme_system");

  const openCommandPalette = () => {
    window.dispatchEvent(new Event("modudoc:open-command-palette"));
  };

  return (
    <header
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(155deg, hsl(157 62% 92%) 0%, hsl(157 54% 86%) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.72)",
          }}
        >
          <img
            src={brandLogo}
            alt="ModuDoc logo"
            style={{ width: 20, height: 20, display: "block" }}
          />
        </div>
        <strong>{t("app_name")}</strong>
        <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
          {activeDocument?.name ?? activeProject?.name ?? t("no_project")}
        </span>
      </div>
      <GlobalSearch />
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => void i18n.changeLanguage(language === "en" ? "zh" : "en")}
          data-testid="header-language-toggle"
          aria-label={`Switch language (current: ${language.toUpperCase()})`}
          title={`Language: ${language.toUpperCase()}`}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
          }}
        >
          {language.toUpperCase()}
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              data-testid="header-theme-menu"
              aria-label={themeLabel}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "hsl(var(--muted-foreground))",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <ActiveIcon
                size={14}
                aria-hidden
                strokeWidth={1.75}
                data-testid={activeOption.iconTestId}
              />
              <span>{themeLabel}</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              data-testid="header-theme-menu-content"
              style={{
                minWidth: 160,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                padding: 6,
                boxShadow: "0 10px 24px rgba(0, 0, 0, 0.14)",
                zIndex: 30,
              }}
            >
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = option.value === theme;
                return (
                  <DropdownMenu.Item
                    key={option.value}
                    data-testid={`theme-menu-${option.value}`}
                    onSelect={() => setTheme(option.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                      background: isActive ? "hsl(var(--accent))" : "transparent",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Icon
                        size={14}
                        aria-hidden
                        strokeWidth={1.75}
                        data-testid={option.iconTestId}
                      />
                      {option.value === "light"
                        ? t("theme_light")
                        : option.value === "dark"
                          ? t("theme_dark")
                          : t("theme_system")}
                    </span>
                    {isActive ? (
                      <span aria-hidden style={{ fontSize: 12, color: "hsl(var(--primary))" }}>
                        ✓
                      </span>
                    ) : null}
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button
          type="button"
          disabled={!activeProjectId}
          data-testid="header-settings"
          onClick={() => setSettingsDialogOpen(true)}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
          }}
        >
          {t("settings")}
        </button>
        <button
          type="button"
          data-testid="header-more"
          onClick={openCommandPalette}
          aria-label={t("command_palette")}
          title={t("command_palette")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            fontSize: 14,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ⋯
        </button>
      </div>
      <CommandPalette openRef={undefined} />
      {message && activeDocumentId ? (
        <div
          data-testid="project-status-popover"
          style={{
            position: "absolute",
            top: 48,
            right: 16,
            zIndex: 5,
            padding: "8px 12px",
            borderRadius: 10,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--primary))",
            color: "hsl(var(--foreground))",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.14)",
          }}
        >
          {tMaybe(t, message)}
          <button
            type="button"
            onClick={() => setDocumentStatusMessage(activeDocumentId, null)}
            style={{
              marginLeft: 8,
              fontSize: 12,
              border: 0,
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
            }}
            aria-label={t("close")}
            data-testid="project-status-close"
          >
            ×
          </button>
        </div>
      ) : null}
    </header>
  );
}
