import type { Extension } from "@codemirror/state";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppResolvedTheme } from "@/app/hooks/useResolvedTheme";
import { useToast } from "@/components/toast/ToastProvider";
import { updateFragment } from "@/lib/api/fragments";
import { scheduleWorkspaceSync } from "@/lib/syncScheduler";
import { applyWorkspaceWriteError } from "@/lib/workspaceWrite";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";

type CodeMirrorComponentType = typeof import("@uiw/react-codemirror")["default"];
const AUTO_SAVE_DELAY_MS = 800;

export function FragmentEditor() {
  const { t } = useTranslation();
  const toast = useToast();
  const resolvedTheme = useAppResolvedTheme();
  const activeFragmentId = useAppStore((state) => state.activeFragmentId);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const fragments = useAppStore((state) => state.fragments);
  const updateEditorDraft = useAppStore((state) => state.updateEditorDraft);
  const flushEditorDraft = useAppStore((state) => state.flushEditorDraft);
  const clearEditorDraft = useAppStore((state) => state.clearEditorDraft);
  const restoreFragmentContent = useAppStore((state) => state.restoreFragmentContent);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);
  const draft = useAppStore((state) =>
    activeFragmentId ? state.editorDrafts[activeFragmentId] : undefined,
  );
  const [editorReady, setEditorReady] = useState(false);
  const fragment = fragments.find((entry) => entry.id === activeFragmentId) ?? null;
  const value = draft ?? fragment?.content ?? "";
  const draftRef = useRef(value);
  const lastFailedAutoSaveRef = useRef<string | null>(null);
  useEffect(() => {
    draftRef.current = value;
  }, [value]);

  useEffect(() => {
    let mounted = true;
    if (!fragment) {
      setEditorReady(false);
      return () => {
        mounted = false;
      };
    }

    void import("@uiw/react-codemirror")
      .then(() => {
        if (mounted) {
          setEditorReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setEditorReady(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fragment]);

  const persistFragment = useEffectEvent(async (nextValue: string, source: "auto" | "blur") => {
    if (!fragment) {
      return;
    }
    if (source === "auto" && lastFailedAutoSaveRef.current === nextValue) {
      return;
    }
    if (nextValue === fragment.content) {
      if (draft === nextValue) {
        clearEditorDraft(fragment.id);
      }
      lastFailedAutoSaveRef.current = null;
      return;
    }

    const previousContent = fragment.content;
    flushEditorDraft(fragment.id);
    try {
      await updateFragment({ id: fragment.id, name: fragment.name, content: nextValue });
    } catch (error) {
      restoreFragmentContent(fragment.id, previousContent);
      lastFailedAutoSaveRef.current = nextValue;
      const message = applyWorkspaceWriteError(setWorkspaceStatusMessage, setCompileStatus, error);
      toast.error(message, t("action_failed"));
      return;
    }

    lastFailedAutoSaveRef.current = null;
    clearEditorDraft(fragment.id);

    if (activeWorkspace?.targetPath) {
      scheduleWorkspaceSync({
        workspaceId: activeWorkspace.id,
        setWorkspaceStatusMessage,
        setCompileStatus,
      });
    }
  });

  useEffect(() => {
    if (!fragment || draft === undefined || draft === fragment.content) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistFragment(draft, "auto");
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [draft, fragment]);

  if (!fragment) {
    return <div style={{ padding: 16 }}>{t("select_fragment_to_edit")}</div>;
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 8 }}>
      <label htmlFor="fragment-editor">
        {t("editor")}: {fragment.name}
      </label>
      {editorReady ? (
        <EditorShell
          value={value}
          onChange={(nextValue) => {
            draftRef.current = nextValue;
            updateEditorDraft(fragment.id, nextValue);
          }}
          onBlur={() => {
            const nextValue = draftRef.current;
            void persistFragment(nextValue, "blur");
          }}
          resolvedTheme={resolvedTheme}
        />
      ) : (
        <textarea
          id="fragment-editor"
          data-testid="fragment-editor"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            draftRef.current = nextValue;
            updateEditorDraft(fragment.id, nextValue);
          }}
          onBlur={() => {
            const nextValue = draftRef.current;
            void persistFragment(nextValue, "blur");
          }}
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
      )}
    </div>
  );
}

function EditorShell({
  value,
  onChange,
  onBlur,
  resolvedTheme,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  onBlur: () => void;
  resolvedTheme: "light" | "dark";
}) {
  const [CodeMirrorComponent, setCodeMirrorComponent] = useState<CodeMirrorComponentType | null>(
    null,
  );
  const [markdownExtension, setMarkdownExtension] = useState<null | (() => Extension)>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([import("@uiw/react-codemirror"), import("@codemirror/lang-markdown")]).then(
      ([codeMirror, markdownLang]) => {
        if (!mounted) return;
        setCodeMirrorComponent(() => codeMirror.default);
        setMarkdownExtension(() => markdownLang.markdown);
      },
    );

    return () => {
      mounted = false;
    };
  }, []);

  if (!CodeMirrorComponent || !markdownExtension) {
    return null;
  }

  const markdown = markdownExtension();
  const theme = resolvedTheme === "dark" ? githubDark : githubLight;

  return (
    <CodeMirrorComponent
      id="fragment-editor"
      value={value}
      height="260px"
      extensions={[markdown]}
      theme={theme}
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}
