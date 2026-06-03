import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore } from "@/store/appStore";

export function FragmentPreview() {
  const { t } = useTranslation();
  const activeFragmentId = useAppStore((state) => state.activeFragmentId);
  const fragments = useAppStore((state) => state.fragments);
  const draft = useAppStore((state) =>
    activeFragmentId ? state.editorDrafts[activeFragmentId] : undefined,
  );
  const fragment = fragments.find((entry) => entry.id === activeFragmentId) ?? null;
  const content = draft ?? fragment?.content ?? "";

  return (
    <div style={{ padding: 16, borderTop: "1px solid hsl(var(--border))" }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h3 style={{ margin: 0 }}>{t("preview")}</h3>
          {fragment ? (
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {fragment.name}
            </div>
          ) : null}
        </div>
        <div
          style={{
            border: "1px solid hsl(var(--border))",
            borderRadius: 18,
            padding: "18px 20px",
            minHeight: 240,
            background:
              "linear-gradient(180deg, hsl(var(--card)), color-mix(in srgb, hsl(var(--muted)) 18%, hsl(var(--card))))",
            boxShadow: "var(--elevation-1)",
          }}
        >
          <div className="prose prose-sm max-w-none">
            {fragment ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p>{t("no_fragment_selected")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
