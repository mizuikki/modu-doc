import { useTranslation } from "react-i18next";
import brandLogo from "@/assets/modudoc-logo.png";
import { GlobalSearch } from "@/features/search/GlobalSearch";
import { SyncStatusBadge } from "@/features/sync/SyncStatusBadge";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

export function Header() {
  const { t, i18n } = useTranslation();
  const workspaceStatusMessage = useAppStore((state) => state.workspaceStatusMessage);
  const theme = useAppStore((state) => state.ui.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const language = i18n.resolvedLanguage ?? i18n.language;

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
          {activeWorkspace?.name ?? t("no_workspace")}
        </span>
      </div>
      <GlobalSearch />
      <div style={{ display: "flex", gap: 8, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
        <button
          type="button"
          onClick={() => void i18n.changeLanguage(language === "en" ? "zh" : "en")}
          data-testid="header-language-toggle"
        >
          {language.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          data-testid="header-theme-toggle"
        >
          {t("theme")}: {theme}
        </button>
        <span>{t("settings")}</span>
        <SyncStatusBadge />
      </div>
      {workspaceStatusMessage ? (
        <div
          data-testid="workspace-status-popover"
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
            pointerEvents: "none",
          }}
        >
          {tMaybe(t, workspaceStatusMessage)}
          <button
            type="button"
            onClick={() => setWorkspaceStatusMessage(null)}
            style={{
              marginLeft: 8,
              fontSize: 12,
              border: 0,
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
              pointerEvents: "auto",
            }}
            aria-label={t("close")}
            data-testid="workspace-status-close"
          >
            ×
          </button>
        </div>
      ) : null}
    </header>
  );
}
