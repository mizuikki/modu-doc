import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { initialUI, useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";

vi.mock("@/app/hooks/useWorkspaceBootstrap", () => ({
  useWorkspaceBootstrap: () => ({
    status: "ready",
    error: null,
    createAndOpen: vi.fn(),
  }),
}));

vi.mock("@/app/hooks/useWorkspaceStatusEvents", () => ({
  useWorkspaceStatusEvents: vi.fn(),
}));

vi.mock("@/app/hooks/useZenModeShortcut", () => ({
  useZenModeShortcut: vi.fn(),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="app-header" />,
}));

vi.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <div data-testid="app-sidebar-content" />,
}));

vi.mock("@/components/layout/StatusBar", () => ({
  StatusBar: () => <div data-testid="app-status-bar" />,
}));

vi.mock("@/features/documents/DocumentEditor", () => ({
  DocumentEditor: () => <div data-testid="document-editor" />,
}));

vi.mock("@/features/documents/RightPanel", () => ({
  RightPanel: () => <aside className="right-panel" data-testid="right-panel" />,
}));

vi.mock("@/features/help/KeyboardCheatsheet", () => ({
  KeyboardCheatsheet: () => null,
}));

vi.mock("@/features/workspaces/WorkspaceSettingsDialog", () => ({
  WorkspaceSettingsDialog: () => null,
}));

describe("App layout", () => {
  it("renders the document-first shell as an explicit three-column grid", () => {
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace 1",
          createdAt: "2026-06-09T00:00:00Z",
          updatedAt: "2026-06-09T00:00:00Z",
        },
      ],
      activeWorkspaceId: "workspace-1",
      documents: [
        {
          id: "document-1",
          workspaceId: "workspace-1",
          name: "Main.md",
          content: "",
          contentHash: "",
          targetPath: null,
          fileStatus: "missing_target",
          lastWrittenAt: null,
          lastWrittenHash: null,
          sortOrder: 0,
          deletedAt: null,
          description: null,
          createdAt: "2026-06-09T00:00:00Z",
          updatedAt: "2026-06-09T00:00:00Z",
        },
      ],
      activeDocumentId: "document-1",
      ui: {
        ...initialUI,
        sidebarWidth: 220,
        rightPanelWidth: 320,
        rightPanelCollapsed: false,
      },
    });

    render(
      <AppTestProviders>
        <App />
      </AppTestProviders>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveStyle({ display: "grid" });
    expect(main.style.gridTemplateColumns).toBe("220px minmax(0, 1fr) 320px");
  });

  it("falls back to default panel widths when persisted ui values are invalid", () => {
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace 1",
          createdAt: "2026-06-09T00:00:00Z",
          updatedAt: "2026-06-09T00:00:00Z",
        },
      ],
      activeWorkspaceId: "workspace-1",
      documents: [
        {
          id: "document-1",
          workspaceId: "workspace-1",
          name: "Main.md",
          content: "",
          contentHash: "",
          targetPath: null,
          fileStatus: "missing_target",
          lastWrittenAt: null,
          lastWrittenHash: null,
          sortOrder: 0,
          deletedAt: null,
          description: null,
          createdAt: "2026-06-09T00:00:00Z",
          updatedAt: "2026-06-09T00:00:00Z",
        },
      ],
      activeDocumentId: "document-1",
      ui: {
        ...initialUI,
        sidebarWidth: Number.NaN,
        rightPanelWidth: Number.NaN,
        rightPanelCollapsed: false,
      },
    });

    render(
      <AppTestProviders>
        <App />
      </AppTestProviders>,
    );

    const mains = screen.getAllByRole("main");
    expect(mains.at(-1)?.style.gridTemplateColumns).toBe("220px minmax(0, 1fr) 320px");
  });
});
