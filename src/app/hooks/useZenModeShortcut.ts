import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";

export function useZenModeShortcut() {
  const toggleZenMode = useAppStore((state) => state.toggleZenMode);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      if (event.key !== "." && event.key !== ">") return;
      event.preventDefault();
      toggleZenMode();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleZenMode]);
}
