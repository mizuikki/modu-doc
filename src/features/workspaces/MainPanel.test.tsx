import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { MainPanel } from "./MainPanel";

vi.mock("@/components/layout/ReadingColumn", () => ({
  ReadingColumn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/fragments/ContinuousEditor", () => ({
  ContinuousEditor: () => <div>continuous-editor</div>,
}));

vi.mock("@/features/fragments/FragmentEditor", () => ({
  FragmentEditor: () => <div>fragment-editor</div>,
}));

vi.mock("@/features/fragments/FragmentPreview", () => ({
  FragmentPreview: () => <div>fragment-preview</div>,
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

describe("MainPanel toolbar", () => {
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
        continuousMode: false,
        viewMode: "split",
        splitRatio: 0.35,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows labels only on active edit and view controls", () => {
    render(
      <AppTestProviders>
        <MainPanel />
      </AppTestProviders>,
    );

    const fragmentButton = screen.getByTestId("mode-fragment");
    const continuousButton = screen.getByTestId("mode-continuous");
    const writeButton = screen.getByTestId("view-mode-write");
    const splitButton = screen.getByTestId("view-mode-split");
    const readButton = screen.getByTestId("view-mode-read");
    const resetButton = screen.getByTestId("reset-split-button");

    expect(fragmentButton).toHaveTextContent("Fragment");
    expect(fragmentButton).toHaveAccessibleName("Fragment");
    expect(continuousButton).not.toHaveTextContent("Continuous");
    expect(continuousButton).toHaveAccessibleName("Continuous");
    expect(writeButton).not.toHaveTextContent("Write");
    expect(writeButton).toHaveAccessibleName("Write");
    expect(splitButton).toHaveTextContent("Split");
    expect(splitButton).toHaveAccessibleName("Split");
    expect(readButton).not.toHaveTextContent("Read");
    expect(readButton).toHaveAccessibleName("Read");
    expect(resetButton).not.toHaveTextContent("Reset split");
    expect(resetButton).toHaveAccessibleName("Reset split");
  });

  it("moves the visible label to the newly active option and hides reset outside split mode", () => {
    render(
      <AppTestProviders>
        <MainPanel />
      </AppTestProviders>,
    );

    const fragmentButton = screen.getByTestId("mode-fragment");
    const continuousButton = screen.getByTestId("mode-continuous");
    const splitButton = screen.getByTestId("view-mode-split");
    const readButton = screen.getByTestId("view-mode-read");

    fireEvent.click(continuousButton);
    fireEvent.click(readButton);

    expect(fragmentButton).not.toHaveTextContent("Fragment");
    expect(continuousButton).toHaveTextContent("Continuous");
    expect(splitButton).not.toHaveTextContent("Split");
    expect(readButton).toHaveTextContent("Read");
    expect(screen.queryByTestId("reset-split-button")).not.toBeInTheDocument();
  });
});
