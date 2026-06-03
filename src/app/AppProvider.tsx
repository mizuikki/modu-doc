import type { ReactNode } from "react";
import { useEffect } from "react";
import { isScreenshotMode, reportScreenshotReady } from "@/app/screenshotMode";
import { forceWorkspaceSync } from "@/lib/syncScheduler";
import { applyWorkspaceWriteError, SAFE_SYNC_POLICY } from "@/lib/workspaceWrite";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";
import { useAppResolvedTheme } from "./hooks/useResolvedTheme";
import { useSaveShortcut } from "./hooks/useSaveShortcut";
import { useWorkspaceBootstrap } from "./hooks/useWorkspaceBootstrap";
import { useWorkspaceStatusEvents } from "./hooks/useWorkspaceStatusEvents";

export function AppProvider({ children }: { children: ReactNode }) {
  const resolvedTheme = useAppResolvedTheme();
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);
  const activeWorkspace = useAppStore(selectActiveWorkspace);

  useWorkspaceBootstrap();
  useWorkspaceStatusEvents();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isScreenshotMode()) {
      return;
    }
    void reportScreenshotReady();
  }, []);

  useSaveShortcut(async () => {
    if (isScreenshotMode()) return;
    if (!activeWorkspace?.targetPath) return;
    try {
      await forceWorkspaceSync({
        workspaceId: activeWorkspace.id,
        policy: SAFE_SYNC_POLICY,
        setWorkspaceStatusMessage,
        setCompileStatus,
      });
    } catch (error) {
      applyWorkspaceWriteError(setWorkspaceStatusMessage, setCompileStatus, error);
    }
  });

  return children;
}
