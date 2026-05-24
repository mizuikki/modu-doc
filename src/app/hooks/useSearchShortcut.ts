import { useEffect } from "react";

export function useSearchShortcut(onSearch: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      onSearch();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearch]);
}
