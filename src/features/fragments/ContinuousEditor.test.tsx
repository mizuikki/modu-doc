import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import {
  buildFragmentMarker,
  ContinuousEditor,
  joinFragmentsForContinuousView,
} from "./ContinuousEditor";

vi.mock("@uiw/react-codemirror", () => {
  throw new Error("codemirror disabled in tests");
});

describe("joinFragmentsForContinuousView", () => {
  it("assembles joined text with marker-prefixed fragment ids", () => {
    const result = joinFragmentsForContinuousView([
      { id: "frag-1", content: "Hello world" },
      { id: "frag-2", content: "Goodbye world" },
    ]);
    expect(result).toBe(
      `${buildFragmentMarker("frag-1")}\nHello world\n${buildFragmentMarker("frag-2")}\nGoodbye world`,
    );
  });

  it("returns an empty string for an empty list", () => {
    expect(joinFragmentsForContinuousView([])).toBe("");
  });
});

describe("ContinuousEditor", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-a",
          name: "Workspace A",
          targetPath: "/tmp/example.md",
          defaultRecipeId: "recipe-a",
          status: "dirty",
          lastCompiledAt: null,
          lastCompiledHash: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
      activeRecipeId: "recipe-a",
      fragments: [
        {
          id: "frag-1",
          workspaceId: "workspace-a",
          name: "Intro",
          content: "Intro body",
          contentHash: "",
          sortOrder: 0,
          isArchived: false,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "frag-2",
          workspaceId: "workspace-a",
          name: "Body",
          content: "Body text",
          contentHash: "",
          sortOrder: 0,
          isArchived: false,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "frag-3",
          workspaceId: "workspace-a",
          name: "Outro",
          content: "Outro body",
          contentHash: "",
          sortOrder: 0,
          isArchived: false,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      recipes: [
        {
          id: "recipe-a",
          workspaceId: "workspace-a",
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
          recipeId: "recipe-a",
          fragmentId: "frag-1",
          enabled: true,
          sortOrder: 0,
        },
        {
          id: "item-2",
          recipeId: "recipe-a",
          fragmentId: "frag-2",
          enabled: true,
          sortOrder: 1,
        },
        {
          id: "item-3",
          recipeId: "recipe-a",
          fragmentId: "frag-3",
          enabled: false,
          sortOrder: 2,
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders only enabled fragments joined with marker lines", () => {
    render(
      <AppTestProviders>
        <ContinuousEditor />
      </AppTestProviders>,
    );

    const editor = screen.getByTestId("continuous-editor");
    const text = editor.textContent ?? "";

    expect(text).toContain("Intro body");
    expect(text).toContain("Body text");
    expect(text).not.toContain("Outro body");
    expect(text).toContain(buildFragmentMarker("frag-1"));
    expect(text).toContain(buildFragmentMarker("frag-2"));
    expect(text).not.toContain(buildFragmentMarker("frag-3"));
  });

  it("reports the count of fragments in the continuous view", () => {
    render(
      <AppTestProviders>
        <ContinuousEditor />
      </AppTestProviders>,
    );

    expect(screen.getByTestId("continuous-count").textContent).toContain("2");
  });

  it("renders an empty state when no recipe is active", () => {
    useAppStore.setState({ activeRecipeId: null });
    render(
      <AppTestProviders>
        <ContinuousEditor />
      </AppTestProviders>,
    );

    expect(screen.getByTestId("continuous-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("continuous-count")).toBeNull();
  });
});
