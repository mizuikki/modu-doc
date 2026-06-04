import type { ReactNode } from "react";
import { DialogProvider } from "@/components/dialog/DialogProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";
import "@/i18n/i18n";
import { useAppStore } from "@/store/appStore";

export function resetAppStore() {
  localStorage.clear();
  useAppStore.persist.clearStorage();
  useAppStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    activeRecipeId: null,
    activeFragmentId: null,
    selectedSnapshotId: null,
    fragments: [],
    recipes: [],
    recipeItems: [],
    snapshots: [],
    editorDrafts: {},
    compileStatus: "idle",
    workspaceStatusMessage: null,
    ui: {
      theme: "light",
      activeMainTab: "edit",
      sidebarCollapsed: false,
      zenMode: false,
      sidebarWidth: 196,
      assemblyWidth: 500,
      cheatsheetOpen: false,
      settingsDialogOpen: false,
    },
  });
}

export function AppTestProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>{children}</DialogProvider>
    </ToastProvider>
  );
}
