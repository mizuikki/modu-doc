import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";

function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((element as HTMLElement).isContentEditable) return true;
  return false;
}

export function useCheatsheetShortcut() {
  const toggleCheatsheet = useAppStore((state) => state.toggleCheatsheet);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableElement(event.target as Element | null)) return;
      if (isEditableElement(document.activeElement)) return;
      event.preventDefault();
      toggleCheatsheet();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCheatsheet]);
}
