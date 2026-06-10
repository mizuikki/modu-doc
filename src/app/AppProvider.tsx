import type { ReactNode } from "react";
import { useEffect } from "react";
import { isScreenshotMode, reportScreenshotReady } from "@/app/screenshotMode";
import { useSaveDocument } from "@/features/documents/useSaveDocument";
import { logDebugPerf } from "@/lib/debugPerf";
import { useAppResolvedTheme } from "./hooks/useResolvedTheme";
import { useSaveShortcut } from "./hooks/useSaveShortcut";

export function AppProvider({ children }: { children: ReactNode }) {
  const resolvedTheme = useAppResolvedTheme();

  const { saveActiveDocument } = useSaveDocument();

  useEffect(() => {
    void logDebugPerf("AppProvider mounted");
    requestAnimationFrame(() => {
      void logDebugPerf("first animation frame");
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isScreenshotMode()) {
      return;
    }
    void reportScreenshotReady();
  }, []);

  useSaveShortcut(() => {
    if (isScreenshotMode()) return;
    void saveActiveDocument().catch(() => undefined);
  });

  return children;
}
