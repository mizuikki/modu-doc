import type { ReactNode } from "react";
import { useEffect } from "react";
import { forceWorkspaceSync } from "@/lib/syncScheduler";
import { applyWorkspaceWriteError, SAFE_SYNC_POLICY } from "@/lib/workspaceWrite";
import { useAppStore } from "@/store/appStore";
import { selectActiveWorkspace } from "@/store/selectors";
import { useSaveShortcut } from "./hooks/useSaveShortcut";
import { useWorkspaceBootstrap } from "./hooks/useWorkspaceBootstrap";
import { useWorkspaceStatusEvents } from "./hooks/useWorkspaceStatusEvents";

export function AppProvider({ children }: { children: ReactNode }) {
  const setWorkspaceStatusMessage = useAppStore((state) => state.setWorkspaceStatusMessage);
  const setCompileStatus = useAppStore((state) => state.setCompileStatus);
  const theme = useAppStore((state) => state.ui.theme);
  const activeWorkspace = useAppStore(selectActiveWorkspace);

  useWorkspaceBootstrap();
  useWorkspaceStatusEvents();

  useEffect(() => {
    const resolvedTheme =
      theme === "system"
        ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [theme]);

  useSaveShortcut(async () => {
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
