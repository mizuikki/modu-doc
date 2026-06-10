import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { MainPanel } from "./MainPanel";

vi.mock("@/features/documents/DocumentEditor", () => ({
  DocumentEditor: () => <div data-testid="document-editor-stub">document-editor</div>,
}));

describe("MainPanel", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      projects: [
        {
          id: "project-1",
          name: "Project 1",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeProjectId: "project-1",
      documents: [
        {
          id: "document-1",
          projectId: "project-1",
          name: "My Document",
          content: "Hello",
          contentHash: "h",
          targetPath: null,
          saveState: "draft",
          lastWrittenAt: null,
          lastWrittenHash: null,
          sortOrder: 0,
          deletedAt: null,
          description: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeDocumentId: "document-1",
      fragments: [
        {
          id: "fragment-1",
          projectId: "project-1",
          name: "Intro",
          content: "Intro body",
          contentHash: "hash-1",
          tags: "",
          category: null,
          sortOrder: 0,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      recipes: [
        {
          id: "recipe-1",
          projectId: "project-1",
          name: "Default",
          description: "",
          deletedAt: null,
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
        centerMode: "edit",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the document-first center panel as a re-export of DocumentEditor", () => {
    render(
      <AppTestProviders>
        <MainPanel />
      </AppTestProviders>,
    );

    expect(screen.getByTestId("document-editor-stub")).toBeInTheDocument();
  });

  it("does not expose legacy fragment/recipe/main-tab controls", () => {
    render(
      <AppTestProviders>
        <MainPanel />
      </AppTestProviders>,
    );

    expect(screen.queryByTestId("main-tab-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-tab-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("main-tab-history")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fragment-editor-stub")).not.toBeInTheDocument();
  });
});
