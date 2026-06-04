import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/toast/ToastProvider";
import { updateFragment } from "@/lib/api/fragments";
import { logDebugPerf } from "@/lib/debugPerf";
import { scheduleWorkspaceSync } from "@/lib/syncScheduler";
import { applyWorkspaceWriteError } from "@/lib/workspaceWrite";
import { useAppStore } from "@/store/appStore";
import { selectActiveFragment, selectActiveWorkspace } from "@/store/selectors";
import { MilkdownEditor } from "./MilkdownEditor";

const AUTO_SAVE_DELAY_MS = 800;

export function FragmentEditor() {
  const { t } = useTranslation();
  const toast = useToast();
  const fragment = useAppStore(selectActiveFragment);
  const activeWorkspace = useAppStore(selectActiveWorkspace);
  const updateEditorDraft = useAppStore((state) => state.updateEditorDraft);
  const flushEditorDraft = useAppStore((state) => state.flushEditorDraft);
  const clearEditorDraft = useAppStore((state) => state.clearEditorDraft);
  const restoreFragmentContent = useAppStore((state) => state.restoreFragmentContent);
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);
  const [value, setValue] = useState(fragment?.content ?? "");
  const valueRef = useRef(value);
  const dirtyRef = useRef(false);
  const loadedFragmentIdRef = useRef<string | null>(fragment?.id ?? null);
  const activeFragmentRef = useRef(fragment);
  const activeWorkspaceRef = useRef(activeWorkspace);
  const lastFailedAutoSaveRef = useRef<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    activeFragmentRef.current = fragment;
  }, [fragment]);

  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
  }, [activeWorkspace]);

  useEffect(() => {
    if (!fragment) {
      void logDebugPerf("fragment editor: active fragment changed", { fragmentId: null });
      loadedFragmentIdRef.current = null;
      dirtyRef.current = false;
      valueRef.current = "";
      setValue("");
      return;
    }

    const fragmentChanged = loadedFragmentIdRef.current !== fragment.id;
    const storeMatchesEditor = fragment.content === valueRef.current;
    void logDebugPerf("fragment editor: active fragment changed", {
      fragmentId: fragment.id,
      fragmentChanged,
      valueBytes: fragment.content.length,
    });
    if (fragmentChanged || !dirtyRef.current || storeMatchesEditor) {
      loadedFragmentIdRef.current = fragment.id;
      dirtyRef.current = false;
      valueRef.current = fragment.content;
      setValue(fragment.content);
      void logDebugPerf("fragment editor: document bound", {
        documentId: fragment.id,
        reason: fragmentChanged
          ? "fragment_changed"
          : storeMatchesEditor
            ? "store_matches"
            : "clean",
        valueBytes: fragment.content.length,
      });
    }
  }, [fragment]);

  const persistFragmentValue = useEffectEvent(
    async (
      targetFragment: typeof fragment,
      targetWorkspace: typeof activeWorkspace,
      nextValue: string,
      source: "auto" | "blur",
    ) => {
      if (!targetFragment) {
        return;
      }
      if (source === "auto" && lastFailedAutoSaveRef.current === nextValue) {
        return;
      }
      if (nextValue === targetFragment.content) {
        if (valueRef.current === nextValue) {
          clearEditorDraft(targetFragment.id);
        }
        dirtyRef.current = false;
        lastFailedAutoSaveRef.current = null;
        return;
      }

      const previousContent = targetFragment.content;
      updateEditorDraft(targetFragment.id, nextValue);
      flushEditorDraft(targetFragment.id);
      try {
        await updateFragment({
          id: targetFragment.id,
          name: targetFragment.name,
          content: nextValue,
        });
      } catch (error) {
        restoreFragmentContent(targetFragment.id, previousContent);
        clearEditorDraft(targetFragment.id);
        dirtyRef.current = true;
        lastFailedAutoSaveRef.current = nextValue;
        const message = applyWorkspaceWriteError(
          setWorkspaceStatusMessage,
          setCompileStatus,
          error,
        );
        toast.error(message, t("action_failed"));
        return;
      }

      lastFailedAutoSaveRef.current = null;
      if (loadedFragmentIdRef.current === targetFragment.id && valueRef.current === nextValue) {
        dirtyRef.current = false;
      }
      clearEditorDraft(targetFragment.id);

      if (targetWorkspace?.targetPath) {
        scheduleWorkspaceSync({
          workspaceId: targetWorkspace.id,
          setWorkspaceStatusMessage,
          setCompileStatus,
        });
      }
    },
  );

  const persistFragment = useEffectEvent(async (nextValue: string, source: "auto" | "blur") => {
    const currentFragment = activeFragmentRef.current;
    if (!currentFragment) {
      return;
    }
    await persistFragmentValue(currentFragment, activeWorkspaceRef.current, nextValue, source);
  });

  useEffect(() => {
    const fragmentToFlush = fragment;
    const workspaceToFlush = activeWorkspace;
    return () => {
      const nextValue = valueRef.current;
      if (!fragmentToFlush || nextValue === fragmentToFlush.content) {
        return;
      }
      void persistFragmentValue(fragmentToFlush, workspaceToFlush, nextValue, "blur");
    };
  }, [activeWorkspace, fragment]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: persistFragment is a useEffectEvent with a stable identity and must not be in deps
  useEffect(() => {
    if (!fragment || value === fragment.content) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistFragment(value, "auto");
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [fragment, persistFragment, value]);

  if (!fragment) {
    return <div style={{ padding: 16 }}>{t("select_fragment_to_edit")}</div>;
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 8 }}>
      <label id="fragment-editor-label" htmlFor="fragment-editor">
        {t("editor")}: {fragment.name}
      </label>
      <MilkdownEditor
        documentId={fragment.id}
        value={value}
        placeholder={t("editor_placeholder")}
        onChange={(nextValue) => {
          valueRef.current = nextValue;
          setValue(nextValue);
          const nextDirty = nextValue !== fragment.content;
          if (nextDirty && !dirtyRef.current) {
            setCompileStatus("editing");
          }
          dirtyRef.current = nextDirty;
          if (nextDirty) {
            lastFailedAutoSaveRef.current = null;
          }
        }}
        onBlur={() => {
          const nextValue = valueRef.current;
          void persistFragment(nextValue, "blur");
        }}
      />
    </div>
  );
}
