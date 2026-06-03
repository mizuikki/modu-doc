import { useEffect } from "react";
import { applyScreenshotScenario, isScreenshotMode } from "@/app/screenshotMode";
import { logDebugPerf } from "@/lib/debugPerf";
import { useAppStore } from "@/store/appStore";
import {
  refreshWorkspaceBundleToStore,
  refreshWorkspaceListToStore,
} from "../data/workspaceRefresh";

export function useWorkspaceBootstrap() {
  const loadWorkspaces = useAppStore((state) => state.loadWorkspaces);
  const setWorkspaceList = useAppStore((state) => state.setWorkspaceList);
  const setWorkspaceBundle = useAppStore((state) => state.setWorkspaceBundle);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    if (isScreenshotMode()) {
      applyScreenshotScenario();
      return;
    }
    void (async () => {
      void logDebugPerf("workspace bootstrap: list start");
      await refreshWorkspaceListToStore({ loadWorkspaces, setWorkspaceList });
      void logDebugPerf("workspace bootstrap: list done", {
        activeWorkspaceId: useAppStore.getState().activeWorkspaceId,
      });
      void logDebugPerf("workspace bootstrap: initial bundle start", {
        activeWorkspaceId: useAppStore.getState().activeWorkspaceId,
      });
      await refreshWorkspaceBundleToStore({
        workspaceId: useAppStore.getState().activeWorkspaceId,
        setWorkspaceBundle,
      });
      void logDebugPerf("workspace bootstrap: initial bundle done", {
        activeWorkspaceId: useAppStore.getState().activeWorkspaceId,
      });
    })();
  }, [loadWorkspaces, setWorkspaceBundle, setWorkspaceList]);

  useEffect(() => {
    if (isScreenshotMode()) {
      return;
    }
    void (async () => {
      void logDebugPerf("workspace bootstrap: active bundle start", { activeWorkspaceId });
      await refreshWorkspaceBundleToStore({ workspaceId: activeWorkspaceId, setWorkspaceBundle });
      void logDebugPerf("workspace bootstrap: active bundle done", { activeWorkspaceId });
    })();
  }, [activeWorkspaceId, setWorkspaceBundle]);
}
