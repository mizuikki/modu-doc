import { replaceAll } from "@milkdown/utils";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { logDebugPerf } from "@/lib/debugPerf";

type CrepeBuilderClass = typeof import("@milkdown/crepe/builder")["CrepeBuilder"];

type MilkdownEditorProps = {
  documentId: string;
  value: string;
  placeholder: string;
  onChange: (nextValue: string) => void;
  onBlur: () => void;
};

type EditorStatus = "loading" | "ready" | "failed";

export function MilkdownEditor({
  documentId,
  value,
  placeholder,
  onChange,
  onBlur,
}: MilkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<InstanceType<CrepeBuilderClass> | null>(null);
  const initialValueRef = useRef(value);
  const documentIdRef = useRef(documentId);
  const placeholderRef = useRef(placeholder);
  const latestMarkdownRef = useRef(value);
  const [status, setStatus] = useState<EditorStatus>("loading");

  const handleChange = useEffectEvent((nextValue: string) => {
    if (nextValue === latestMarkdownRef.current) {
      return;
    }
    latestMarkdownRef.current = nextValue;
    void logDebugPerf("milkdown: markdown updated", {
      documentId: documentIdRef.current,
      valueBytes: nextValue.length,
    });
    onChange(nextValue);
  });

  const handleBlur = useEffectEvent(() => {
    const nextValue = editorRef.current?.getMarkdown();
    if (typeof nextValue === "string" && nextValue !== latestMarkdownRef.current) {
      latestMarkdownRef.current = nextValue;
      onChange(nextValue);
    }
    onBlur();
  });

  useEffect(() => {
    latestMarkdownRef.current = value;
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || status !== "ready") {
      return;
    }

    const currentMarkdown = editor.getMarkdown();
    const documentChanged = documentIdRef.current !== documentId;
    documentIdRef.current = documentId;
    if (!documentChanged && currentMarkdown === value) {
      return;
    }

    void logDebugPerf("milkdown: replace start", {
      documentId,
      documentChanged,
      valueBytes: value.length,
    });
    editor.editor.action(replaceAll(value, documentChanged));
    void logDebugPerf("milkdown: replace done", {
      documentId,
      documentChanged,
      valueBytes: value.length,
    });
  }, [documentId, status, value]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let isDisposed = false;
    let mountedEditor: InstanceType<CrepeBuilderClass> | null = null;

    async function mountEditor() {
      try {
        void logDebugPerf("milkdown: import start");
        const [{ CrepeBuilder }, { placeholder }, { listItem }, { linkTooltip }] =
          await Promise.all([
            import("@milkdown/crepe/builder"),
            import("@milkdown/crepe/feature/placeholder"),
            import("@milkdown/crepe/feature/list-item"),
            import("@milkdown/crepe/feature/link-tooltip"),
          ]);
        void logDebugPerf("milkdown: import done");
        if (!hostRef.current || isDisposed) {
          return;
        }

        void logDebugPerf("milkdown: create start");
        const editor = new CrepeBuilder({
          root: hostRef.current,
          defaultValue: initialValueRef.current,
        });
        editor.addFeature(placeholder, {
          text: placeholderRef.current,
          mode: "block",
        });
        editor.addFeature(listItem);
        editor.addFeature(linkTooltip);

        editor.on((listener) => {
          listener.markdownUpdated((_ctx, markdown) => {
            handleChange(markdown);
          });
        });

        await editor.create();
        void logDebugPerf("milkdown: create done");
        if (isDisposed) {
          await editor.destroy().catch(() => undefined);
          return;
        }

        mountedEditor = editor;
        editorRef.current = editor;
        setStatus("ready");
        void logDebugPerf("milkdown: editor ready", {
          documentId: documentIdRef.current,
          valueBytes: latestMarkdownRef.current.length,
        });
      } catch {
        if (!isDisposed) {
          hostRef.current?.replaceChildren();
          setStatus("failed");
        }
      }
    }

    setStatus("loading");
    void mountEditor();

    return () => {
      isDisposed = true;
      const editor = mountedEditor ?? editorRef.current;
      editorRef.current = null;
      if (editor) {
        void editor.destroy().catch(() => undefined);
        return;
      }
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    function onFocusOut(event: FocusEvent) {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && hostRef.current?.contains(nextTarget)) {
        return;
      }
      handleBlur();
    }

    host.addEventListener("focusout", onFocusOut);
    return () => host.removeEventListener("focusout", onFocusOut);
  }, []);

  return (
    <div
      id="fragment-editor"
      ref={hostRef}
      data-testid="fragment-editor"
      className="milkdown-fragment-editor"
      data-editor-status={status}
    >
      {status === "failed" ? (
        <textarea
          aria-label="fragment-editor-fallback"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            latestMarkdownRef.current = nextValue;
            onChange(nextValue);
          }}
          rows={12}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 320,
            padding: 12,
            borderRadius: 16,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
        />
      ) : null}
    </div>
  );
}
