import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { FragmentEditor } from "./FragmentEditor";

vi.mock("@uiw/react-codemirror", () => {
  throw new Error("codemirror disabled in tests");
});

const { updateFragment, scheduleWorkspaceSync, forceWorkspaceSync } = vi.hoisted(() => ({
  updateFragment: vi.fn(async () => ({
    id: "fragment-a",
    workspace_id: "workspace-a",
    name: "Intro",
    content: "Updated body",
    content_hash: "",
    sort_order: 0,
    is_archived: false,
    deleted_at: null,
    created_at: "t",
    updated_at: "t",
  })),
  scheduleWorkspaceSync: vi.fn(),
  forceWorkspaceSync: vi.fn(),
}));

vi.mock("@/lib/api/fragments", () => ({
  updateFragment,
}));

vi.mock("@/lib/syncScheduler", () => ({
  scheduleWorkspaceSync,
  forceWorkspaceSync,
}));

describe("FragmentEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateFragment.mockClear();
    scheduleWorkspaceSync.mockClear();
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-a",
          name: "Workspace A",
          targetPath: "/tmp/example.md",
          defaultRecipeId: null,
          status: "dirty",
          lastCompiledAt: null,
          lastCompiledHash: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
      activeFragmentId: "fragment-a",
      fragments: [
        {
          id: "fragment-a",
          workspaceId: "workspace-a",
          name: "Intro",
          content: "Initial body",
          contentHash: "",
          sortOrder: 0,
          isArchived: false,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("auto-saves drafts and schedules workspace sync", async () => {
    render(
      <AppTestProviders>
        <FragmentEditor />
      </AppTestProviders>,
    );

    const textbox = screen.getByTestId("fragment-editor");
    fireEvent.change(textbox, { target: { value: "Updated body" } });

    await vi.advanceTimersByTimeAsync(900);

    expect(updateFragment).toHaveBeenCalledWith({
      id: "fragment-a",
      name: "Intro",
      content: "Updated body",
    });
    expect(scheduleWorkspaceSync).toHaveBeenCalled();
  });

  it("restores fragment content when autosave fails", async () => {
    updateFragment.mockImplementationOnce(async () => {
      throw new Error("database_error");
    });

    render(
      <AppTestProviders>
        <FragmentEditor />
      </AppTestProviders>,
    );

    const textbox = screen.getByTestId("fragment-editor");
    fireEvent.change(textbox, { target: { value: "Broken body" } });

    await vi.advanceTimersByTimeAsync(900);

    expect(useAppStore.getState().fragments[0]?.content).toBe("Initial body");
  });
});
