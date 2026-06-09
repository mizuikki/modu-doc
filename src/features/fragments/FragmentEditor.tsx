import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { updateFragment } from "@/lib/api/fragments";
import { normalizeAppError } from "@/lib/appError";
import type { Fragment } from "@/store/types";
import { MilkdownEditor } from "./MilkdownEditor";

const AUTO_SAVE_DELAY_MS = 800;

type FragmentEditorProps = {
  fragment: Fragment;
  onClose?: () => void;
};

/**
 * The fragment editor is now a focused modal-style component used from the
 * right panel's Fragments tab. It is no longer the default main-panel editor
 * (that role is owned by `DocumentEditor`).
 *
 * Edits are persisted via `updateFragment` on a debounce. There is no longer a
 * workspace-level sync or recipe target to flush to; conflicts are tracked on
 * the bound document instead, and `DocumentTargetBar` writes the file.
 */
export function FragmentEditor({ fragment, onClose }: FragmentEditorProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [value, setValue] = useState(fragment.content);
  const [saving, setSaving] = useState(false);

  // Reset the local buffer when the active fragment changes.
  useEffect(() => {
    setValue(fragment.content);
  }, [fragment.content]);

  // Debounced auto-save: send every change to the backend after a quiet period.
  useEffect(() => {
    if (value === fragment.content) {
      return;
    }
    const timeoutId = window.setTimeout(async () => {
      setSaving(true);
      try {
        await updateFragment({ id: fragment.id, content: value });
      } catch (error) {
        toast.error(normalizeAppError(error), t("action_failed"));
      } finally {
        setSaving(false);
      }
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [fragment.content, fragment.id, t, toast, value]);

  return (
    <div
      style={{
        padding: 16,
        display: "grid",
        gap: 8,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <label id="fragment-editor-label" htmlFor="fragment-editor">
          {t("editor")}: {fragment.name}
          {saving ? ` (${t("saving")})` : ""}
        </label>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            data-testid="fragment-editor-close"
            style={{
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              padding: "4px 10px",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              cursor: "pointer",
            }}
          >
            {t("close")}
          </button>
        ) : null}
      </div>
      <MilkdownEditor
        documentId={fragment.id}
        value={value}
        placeholder={t("editor_placeholder")}
        onChange={(nextValue) => setValue(nextValue)}
        onBlur={() => undefined}
      />
    </div>
  );
}
