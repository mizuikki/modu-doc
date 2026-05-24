import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { GlobalSearch } from "./GlobalSearch";

vi.mock("@/lib/api/search", () => ({
  searchWorkspaceContent: vi.fn(async () => [
    {
      kind: "fragment",
      id: "fragment-1",
      workspace_id: "workspace-a",
      title: "Intro",
      subtitle: "Hello",
    },
    {
      kind: "workspace",
      id: "workspace-b",
      workspace_id: null,
      title: "Workspace B",
      subtitle: "dirty",
    },
  ]),
}));

describe("GlobalSearch", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-a",
          name: "Workspace A",
          targetPath: null,
          defaultRecipeId: null,
          status: "missing_target",
          lastCompiledAt: null,
          lastCompiledHash: null,
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "workspace-b",
          name: "Workspace B",
          targetPath: null,
          defaultRecipeId: null,
          status: "dirty",
          lastCompiledAt: null,
          lastCompiledHash: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("queries backend search and navigates on click", async () => {
    render(
      <AppTestProviders>
        <GlobalSearch />
      </AppTestProviders>,
    );

    const input = screen.getByLabelText(/search/i);
    fireEvent.change(input, { target: { value: "intro" } });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const fragmentResult = await screen.findByRole("option", { name: /intro/i });
    fireEvent.click(fragmentResult);
    expect(useAppStore.getState().activeWorkspaceId).toBe("workspace-a");
    expect(useAppStore.getState().activeFragmentId).toBe("fragment-1");

    fireEvent.change(input, { target: { value: "workspace" } });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const workspaceResult = await screen.findByRole("option", { name: /workspace b/i });
    fireEvent.click(workspaceResult);
    expect(useAppStore.getState().activeWorkspaceId).toBe("workspace-b");
  });

  it("supports keyboard navigation and escape", async () => {
    render(
      <AppTestProviders>
        <GlobalSearch />
      </AppTestProviders>,
    );

    const input = screen.getByLabelText(/search/i);
    fireEvent.change(input, { target: { value: "intro" } });

    await new Promise((resolve) => setTimeout(resolve, 200));

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useAppStore.getState().activeFragmentId).toBe("fragment-1");

    fireEvent.change(input, { target: { value: "intro" } });
    await new Promise((resolve) => setTimeout(resolve, 200));
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
  });
});
