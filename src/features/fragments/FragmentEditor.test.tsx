import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { FragmentEditor } from "./FragmentEditor";

vi.mock("./MilkdownEditor", () => ({
  MilkdownEditor: ({
    documentId,
    value,
    onChange,
    onBlur,
  }: {
    documentId: string;
    value: string;
    onChange: (nextValue: string) => void;
    onBlur: () => void;
  }) => (
    <textarea
      data-testid="fragment-editor"
      data-document-id={documentId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  ),
}));

const { updateFragment, scheduleWorkspaceSync } = vi.hoisted(() => ({
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
}));

vi.mock("@/lib/api/fragments", () => ({
  updateFragment,
}));

vi.mock("@/lib/syncScheduler", () => ({
  scheduleWorkspaceSync,
  forceWorkspaceSync: vi.fn(),
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
        {
          id: "fragment-b",
          workspaceId: "workspace-a",
          name: "Outro",
          content: "Second body",
          contentHash: "",
          sortOrder: 1,
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

  it("does not save on initial mount", async () => {
    render(
      <AppTestProviders>
        <FragmentEditor />
      </AppTestProviders>,
    );

    await vi.advanceTimersByTimeAsync(900);
    expect(updateFragment).not.toHaveBeenCalled();
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

  it("flushes the current draft before switching fragments", async () => {
    render(
      <AppTestProviders>
        <FragmentEditor />
      </AppTestProviders>,
    );

    fireEvent.change(screen.getByTestId("fragment-editor"), {
      target: { value: "Switched body" },
    });

    useAppStore.getState().setActiveFragment("fragment-b");

    await Promise.resolve();

    expect(updateFragment).toHaveBeenCalledWith({
      id: "fragment-a",
      name: "Intro",
      content: "Switched body",
    });
  });

  it("reuses the editor instance when switching fragments", async () => {
    render(
      <AppTestProviders>
        <FragmentEditor />
      </AppTestProviders>,
    );

    const firstEditor = screen.getByTestId("fragment-editor");
    expect(firstEditor).toHaveAttribute("data-document-id", "fragment-a");

    useAppStore.getState().setActiveFragment("fragment-b");
    await Promise.resolve();

    const secondEditor = screen.getByTestId("fragment-editor");
    expect(secondEditor).toBe(firstEditor);
    expect(secondEditor).toHaveAttribute("data-document-id", "fragment-b");
  });
});
