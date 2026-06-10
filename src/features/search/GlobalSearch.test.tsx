import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { GlobalSearch } from "./GlobalSearch";

vi.mock("@/lib/api/search", () => ({
  searchProjectContent: vi.fn(async () => [
    {
      kind: "fragment",
      id: "fragment-1",
      project_id: "project-a",
      document_id: null,
      title: "Intro",
      subtitle: "Hello",
    },
    {
      kind: "document",
      id: "document-1",
      project_id: "project-a",
      document_id: null,
      title: "Main",
      subtitle: "Document body",
    },
    {
      kind: "project",
      id: "project-b",
      project_id: null,
      document_id: null,
      title: "Project B",
      subtitle: "ready",
    },
  ]),
}));

describe("GlobalSearch", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      projects: [
        {
          id: "project-a",
          name: "Project A",
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "project-b",
          name: "Project B",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeProjectId: "project-a",
      documents: [
        {
          id: "document-1",
          projectId: "project-a",
          name: "Main",
          content: "Document body",
          contentHash: "",
          targetPath: null,
          saveState: "unsaved",
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
    expect(useAppStore.getState().activeProjectId).toBe("project-a");
    expect(useAppStore.getState().ui.rightPanelTab).toBe("fragments");

    fireEvent.change(input, { target: { value: "main" } });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const documentResult = await screen.findByRole("option", { name: /main/i });
    fireEvent.click(documentResult);
    expect(useAppStore.getState().activeProjectId).toBe("project-a");
    expect(useAppStore.getState().activeDocumentId).toBe("document-1");
    expect(useAppStore.getState().ui.centerMode).toBe("edit");

    fireEvent.change(input, { target: { value: "project" } });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const projectResult = await screen.findByRole("option", { name: /project b/i });
    fireEvent.click(projectResult);
    expect(useAppStore.getState().activeProjectId).toBe("project-b");
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
