import { useTranslation } from "react-i18next";
import { tMaybe } from "@/i18n/tMaybe";
import { useAppStore } from "@/store/appStore";

const statusColor: Record<string, string> = {
  idle: "hsl(var(--muted-foreground))",
  editing: "hsl(38 92% 50%)",
  saving: "hsl(199 89% 48%)",
  compiling: "hsl(219 84% 56%)",
  synced: "hsl(var(--primary))",
  error: "hsl(0 84% 60%)",
  conflicted: "hsl(8 84% 60%)",
};

export function SyncStatusBadge() {
  const { t } = useTranslation();
  const compileStatus = useAppStore((state) => state.compileStatus);
  const workspaceStatusMessage = useAppStore((state) => state.workspaceStatusMessage);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        fontSize: 12,
        color: "hsl(var(--foreground))",
      }}
      title={workspaceStatusMessage ? tMaybe(t, workspaceStatusMessage) : ""}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: statusColor[compileStatus] ?? statusColor.idle,
        }}
      />
      <span>
        {t("status")}: {tMaybe(t, compileStatus)}
      </span>
    </div>
  );
}
