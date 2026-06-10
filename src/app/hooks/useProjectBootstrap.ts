import { useEffect, useState } from "react";
import {
  createProjectWithFirstDocument,
  fetchProjectBundle,
  fetchProjects,
} from "@/app/data/projectData";
import { applyScreenshotScenario, isScreenshotMode } from "@/app/screenshotMode";
import { useAppStore } from "@/store/appStore";

export type BootstrapStatus = "idle" | "loading" | "ready" | "error";

export function useProjectBootstrap() {
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
        const list = await fetchProjects();
        if (cancelled) return;
        const state = useAppStore.getState();
        const activeId = state.activeProjectId ?? list[0]?.id ?? null;
        if (!activeId) {
          if (!cancelled) {
            setStatus("ready");
          }
          return;
        }
        await fetchProjectBundle(activeId);
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
    await createProjectWithFirstDocument(name);
  };

  return { status, error, createAndOpen };
}
