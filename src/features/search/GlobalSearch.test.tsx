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
      kind: "document",
      id: "document-1",
      workspace_id: "workspace-a",
      title: "Main",
      subtitle: "Document body",
    },
    {
      kind: "workspace",
      id: "workspace-b",
      workspace_id: null,
      title: "Workspace B",
      subtitle: "ready",
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
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "workspace-b",
          name: "Workspace B",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
      documents: [
        {
          id: "document-1",
          workspaceId: "workspace-a",
          name: "Main",
          content: "Document body",
          contentHash: "",
          targetPath: null,
          fileStatus: "dirty",
          lastWrittenAt: null,
          lastWrittenHash: null,
          sortOrder: 0,
          deletedAt: null,
          description: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
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
    expect(useAppStore.getState().ui.rightPanelTab).toBe("fragments");

    fireEvent.change(input, { target: { value: "main" } });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const documentResult = await screen.findByRole("option", { name: /main/i });
    fireEvent.click(documentResult);
    expect(useAppStore.getState().activeWorkspaceId).toBe("workspace-a");
    expect(useAppStore.getState().activeDocumentId).toBe("document-1");
    expect(useAppStore.getState().ui.centerMode).toBe("edit");

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
    expect(useAppStore.getState().ui.rightPanelTab).toBe("fragments");

    fireEvent.change(input, { target: { value: "intro" } });
    await new Promise((resolve) => setTimeout(resolve, 200));
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
  });
});
