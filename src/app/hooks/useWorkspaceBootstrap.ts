import { useEffect } from "react";
import { applyScreenshotScenario, isScreenshotMode } from "@/app/screenshotMode";
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
    void refreshWorkspaceListToStore({ loadWorkspaces, setWorkspaceList }).then(() => {
      void refreshWorkspaceBundleToStore({
        workspaceId: useAppStore.getState().activeWorkspaceId,
        setWorkspaceBundle,
      });
    });
  }, [loadWorkspaces, setWorkspaceBundle, setWorkspaceList]);

  useEffect(() => {
    if (isScreenshotMode()) {
      return;
    }
    void refreshWorkspaceBundleToStore({ workspaceId: activeWorkspaceId, setWorkspaceBundle });
  }, [activeWorkspaceId, setWorkspaceBundle]);
}
