import type { ReactNode } from "react";
import { DialogProvider } from "@/components/dialog/DialogProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";
import "@/i18n/i18n";
import { initialUI, useAppStore } from "@/store/appStore";

export function resetAppStore() {
  localStorage.clear();
  useAppStore.persist.clearStorage();
  useAppStore.setState({
    projects: [],
    activeProjectId: null,
    documents: [],
    activeDocumentId: null,
    fragments: [],
    recipes: [],
    recipeItems: [],
    snapshotsByDocumentId: {},
    selectedSnapshotId: null,
    documentDrafts: {},
    documentProcessStatus: {},
    documentStatusMessage: {},
    ui: { ...initialUI },
  });
}

export function AppTestProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>{children}</DialogProvider>
    </ToastProvider>
  );
}
