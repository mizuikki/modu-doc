import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function getSystemDarkMode() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function useResolvedTheme(theme: ThemeMode) {
  const [systemDark, setSystemDark] = useState(() => getSystemDarkMode());

  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setSystemDark(mediaQuery.matches);
    };

    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [theme]);

  return (theme === "system" ? (systemDark ? "dark" : "light") : theme) as ResolvedTheme;
}

export function useAppResolvedTheme() {
  const theme = useAppStore((state) => state.ui.theme);
  return useResolvedTheme(theme);
}
