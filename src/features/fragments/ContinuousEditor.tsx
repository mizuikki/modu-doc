import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppResolvedTheme } from "@/app/hooks/useResolvedTheme";
import { useAppStore } from "@/store/appStore";

type CodeMirrorComponentType = typeof import("@uiw/react-codemirror")["default"];

export const FRAGMENT_SEPARATOR_PREFIX = "---FRAGMENT:";
export const FRAGMENT_SEPARATOR_SUFFIX = "---";

export function buildFragmentMarker(fragmentId: string) {
  return `${FRAGMENT_SEPARATOR_PREFIX}${fragmentId}${FRAGMENT_SEPARATOR_SUFFIX}`;
}

export function joinFragmentsForContinuousView(
  fragments: { id: string; content: string }[],
): string {
  return fragments
    .map((fragment) => `${buildFragmentMarker(fragment.id)}\n${fragment.content}`)
    .join("\n");
}

export function ContinuousEditor() {
  const { t } = useTranslation();
  const resolvedTheme = useAppResolvedTheme();
  const activeRecipeId = useAppStore((state) => state.activeRecipeId);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const fragments = useAppStore((state) => state.fragments);
  const recipeItems = useAppStore((state) => state.recipeItems);
  const editorDrafts = useAppStore((state) => state.editorDrafts);

  const enabledFragments = useMemo(() => {
    if (!activeRecipeId) {
      return [];
    }
    const items = recipeItems
      .filter((item) => item.recipeId === activeRecipeId && item.enabled)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items
      .map((item) => fragments.find((entry) => entry.id === item.fragmentId))
      .filter((entry): entry is (typeof fragments)[number] => Boolean(entry))
      .filter((entry) => entry.deletedAt === null && entry.workspaceId === activeWorkspaceId)
      .map((entry) => ({
        id: entry.id,
        content: editorDrafts[entry.id] ?? entry.content,
      }));
  }, [activeRecipeId, activeWorkspaceId, editorDrafts, fragments, recipeItems]);

  const joinedText = useMemo(
    () => joinFragmentsForContinuousView(enabledFragments),
    [enabledFragments],
  );

  if (!activeRecipeId) {
    return (
      <div data-testid="continuous-editor" style={{ padding: 16 }}>
        {t("no_active_recipe")}
      </div>
    );
  }

  return (
    <div data-testid="continuous-editor" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
        }}
      >
        <span data-testid="continuous-count">
          {t("continuous_view_count", { n: enabledFragments.length })}
        </span>
      </div>
      <ContinuousEditorShell value={joinedText} resolvedTheme={resolvedTheme} />
    </div>
  );
}

function ContinuousEditorShell({
  value,
  resolvedTheme,
}: {
  value: string;
  resolvedTheme: "light" | "dark";
}) {
  const [CodeMirrorComponent, setCodeMirrorComponent] = useState<CodeMirrorComponentType | null>(
    null,
  );
  const [markdownExtension, setMarkdownExtension] = useState<null | (() => Extension)>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([import("@uiw/react-codemirror"), import("@codemirror/lang-markdown")])
      .then(([codeMirror, markdownLang]) => {
        if (!mounted) return;
        setCodeMirrorComponent(() => codeMirror.default);
        setMarkdownExtension(() => markdownLang.markdown);
      })
      .catch(() => {
        if (!mounted) return;
        setCodeMirrorComponent(null);
        setMarkdownExtension(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!CodeMirrorComponent || !markdownExtension) {
    return (
      <textarea
        aria-label="continuous-editor-fallback"
        value={value}
        readOnly
        rows={12}
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 260,
          padding: 12,
          borderRadius: 12,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
        }}
      />
    );
  }

  const markdown = markdownExtension();
  const theme = resolvedTheme === "dark" ? githubDark : githubLight;
  const readOnlyExtensions: Extension[] = [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
  ];

  return (
    <CodeMirrorComponent
      value={value}
      height="260px"
      extensions={[markdown, ...readOnlyExtensions]}
      theme={theme}
      editable={false}
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
    />
  );
}
