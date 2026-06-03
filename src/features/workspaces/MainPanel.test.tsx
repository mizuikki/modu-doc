import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { MainPanel } from "./MainPanel";

vi.mock("@/components/layout/ReadingColumn", () => ({
  ReadingColumn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/fragments/FragmentEditor", () => ({
  FragmentEditor: () => <div data-testid="fragment-editor-stub">fragment-editor</div>,
}));

vi.mock("@/features/history/SnapshotDiff", () => ({
  SnapshotDiff: () => <div>snapshot-diff</div>,
}));

vi.mock("@/features/history/SnapshotTimeline", () => ({
  SnapshotTimeline: () => <div>snapshot-timeline</div>,
}));

vi.mock("@/features/sync/ConflictBanner", () => ({
  ConflictBanner: () => null,
}));

vi.mock("@/features/workspaces/WorkspacePreview", () => ({
  WorkspacePreview: () => <div>workspace-preview</div>,
}));

describe("MainPanel", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      activeWorkspaceId: "workspace-1",
      activeRecipeId: "recipe-1",
      activeFragmentId: "fragment-1",
      fragments: [
        {
          id: "fragment-1",
          workspaceId: "workspace-1",
          name: "Intro",
          content: "Intro body",
          contentHash: "hash-1",
          sortOrder: 0,
          isArchived: false,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      recipes: [
        {
          id: "recipe-1",
          workspaceId: "workspace-1",
          name: "Default",
          description: "",
          isActive: true,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      recipeItems: [
        {
          id: "item-1",
          recipeId: "recipe-1",
          fragmentId: "fragment-1",
          enabled: true,
          sortOrder: 0,
        },
      ],
      ui: {
        ...useAppStore.getState().ui,
        activeMainTab: "edit",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the simplified edit surface without legacy mode controls", () => {
    render(
      <AppTestProviders>
        <MainPanel />
      </AppTestProviders>,
    );

    expect(screen.getByTestId("main-tab-edit")).toHaveAccessibleName("Edit");
    expect(screen.queryByTestId("mode-fragment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-mode-write")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reset-split-button")).not.toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByTestId("fragment-editor-stub")).toBeInTheDocument();
  });

  it("switches between top-level tabs", () => {
    render(
      <AppTestProviders>
        <MainPanel />
      </AppTestProviders>,
    );

    expect(screen.getByTestId("fragment-editor-stub")).toBeInTheDocument();
    expect(screen.queryByText("workspace-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("main-tab-preview"));
    expect(screen.getByText("workspace-preview")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("main-tab-history"));
    expect(screen.getByText("snapshot-timeline")).toBeInTheDocument();
  });
});
