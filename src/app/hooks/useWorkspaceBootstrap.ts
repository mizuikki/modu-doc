import { useEffect, useState } from "react";
import {
  createWorkspaceWithFirstDocument,
  fetchWorkspaceBundle,
  fetchWorkspaces,
} from "@/app/data/workspaceData";
import { applyScreenshotScenario, isScreenshotMode } from "@/app/screenshotMode";
import { useAppStore } from "@/store/appStore";

export type BootstrapStatus = "idle" | "loading" | "ready" | "error";

export function useWorkspaceBootstrap() {
  const [status, setStatus] = useState<BootstrapStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isScreenshotMode()) {
        applyScreenshotScenario();
        if (!cancelled) {
          setError(null);
          setStatus("ready");
        }
        return;
      }

      setStatus("loading");
      setError(null);
      try {
        const list = await fetchWorkspaces();
        if (cancelled) return;
        const state = useAppStore.getState();
        const activeId = state.activeWorkspaceId ?? list[0]?.id ?? null;
        if (!activeId) {
          if (!cancelled) {
            setStatus("ready");
          }
          return;
        }
        await fetchWorkspaceBundle(activeId);
        if (cancelled) return;
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createAndOpen = async (name: string) => {
    await createWorkspaceWithFirstDocument(name);
  };

  return { status, error, createAndOpen };
}
