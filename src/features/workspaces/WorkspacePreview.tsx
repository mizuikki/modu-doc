import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { tMaybe } from "@/i18n/tMaybe";
import { openTargetInFileManager } from "@/lib/api/misc";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument, selectActiveWorkspace } from "@/store/selectors";
import type { DocumentFileStatus } from "@/store/types";

const STATUS_LABEL_KEYS: Record<DocumentFileStatus, string> = {
  missing_target: "missing_target",
  dirty: "dirty",
  ready: "ready",
  conflicted: "conflicted",
  error: "error",
};

export function WorkspacePreview() {
  const { t } = useTranslation();
  const setSettingsDialogOpen = useAppStore((state) => state.setSettingsDialogOpen);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const activeDocument = useAppStore(selectActiveDocument);

  const status = activeDocument?.fileStatus ?? "missing_target";
  const statusLabel = tMaybe(t, STATUS_LABEL_KEYS[status] ?? "missing_target");

  return (
    <div style={{ padding: 20, display: "grid", gap: 16 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <section
          style={{
            border: "1px solid hsl(var(--border))",
            borderRadius: 20,
            padding: 20,
            background:
              "linear-gradient(180deg, hsl(var(--card)), color-mix(in srgb, hsl(var(--muted)) 30%, hsl(var(--card))))",
            boxShadow: "var(--elevation-1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                {t("preview")}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {activeWorkspace?.name ?? t("no_workspace")}
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {tMaybe(t, "created_at")}:{" "}
                  {activeWorkspace ? new Date(activeWorkspace.createdAt).toLocaleString() : "—"}
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {tMaybe(t, "updated_at")}:{" "}
                  {activeWorkspace ? new Date(activeWorkspace.updatedAt).toLocaleString() : "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {t("status")}: {statusLabel}
                </span>
                {activeDocument ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid hsl(var(--primary))",
                      background: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)",
                      color: "hsl(var(--primary))",
                    }}
                  >
                    {activeDocument.name}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  overflowWrap: "anywhere",
                }}
              >
                <strong>{t("current_target")}:</strong>{" "}
                {activeDocument?.targetPath ? (
                  activeDocument.targetPath
                ) : (
                  <button
                    type="button"
                    onClick={() => setSettingsDialogOpen(true)}
                    data-testid="preview-set-target"
                    style={{
                      border: "1px solid hsl(var(--primary))",
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("set_compile_target")}
                  </button>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {t("last_written_at")}:{" "}
                {activeDocument?.lastWrittenAt
                  ? new Date(activeDocument.lastWrittenAt).toLocaleString()
                  : "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!activeDocument?.targetPath) return;
                void openTargetInFileManager(activeDocument.id);
              }}
              disabled={!activeDocument?.targetPath}
              data-testid="preview-open-target-folder"
            >
              {t("open_target_folder")}
            </button>
          </div>
        </section>

        <section
          style={{
            border: "1px solid hsl(var(--border))",
            borderRadius: 22,
            padding: "22px 24px",
            minHeight: 320,
            background: "hsl(var(--card))",
            boxShadow: "var(--elevation-1)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
              marginBottom: 14,
            }}
          >
            {t("preview")}
          </div>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {activeDocument?.content || t("empty_fragment")}
            </ReactMarkdown>
          </div>
        </section>
      </div>
    </div>
  );
}
