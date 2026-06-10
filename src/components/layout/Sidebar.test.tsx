import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";

describe("Sidebar", () => {
  beforeEach(() => {
    resetAppStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows draft documents as local drafts without warning indicators", () => {
    useAppStore.setState({
      projects: [
        {
          id: "ws-1",
          name: "Untitled Project",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeProjectId: "ws-1",
      documents: [
        {
          id: "doc-1",
          projectId: "ws-1",
          name: "Untitled.md",
          content: "",
          contentHash: "hash",
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
      activeDocumentId: "doc-1",
    });

    render(
      <AppTestProviders>
        <Sidebar />
      </AppTestProviders>,
    );

    expect(screen.queryByTestId("sidebar-document-status-doc-1")).not.toBeInTheDocument();
    expect(screen.getByText("Local draft")).toBeInTheDocument();
  });

  it("keeps long document status out of the sidebar row", () => {
    useAppStore.setState({
      projects: [
        {
          id: "ws-1",
          name: "A very long project name that should live in the switcher",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeProjectId: "ws-1",
      documents: [
        {
          id: "doc-1",
          projectId: "ws-1",
          name: "Very long document title that should truncate in the sidebar.md",
          content: "",
          contentHash: "hash",
          targetPath: "/tmp/a-very-long-target-folder/conflict.md",
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
      activeDocumentId: "doc-1",
    });

    render(
      <AppTestProviders>
        <Sidebar />
      </AppTestProviders>,
    );

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar-document-status-doc-1")).toHaveAttribute(
      "aria-label",
      "Unsaved changes",
    );
    expect(screen.getByTestId("sidebar-project-switcher")).toHaveAttribute(
      "title",
      "A very long project name that should live in the switcher",
    );
  });
});
