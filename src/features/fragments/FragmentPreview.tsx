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
      <h3>{t("preview")}</h3>
      <div className="prose prose-sm max-w-none">
        {fragment ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : (
          <p>{t("no_fragment_selected")}</p>
        )}
      </div>
    </div>
  );
}
