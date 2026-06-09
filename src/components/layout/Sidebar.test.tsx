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

  it("keeps the document status badge on a single line", () => {
    useAppStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Untitled",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "ws-1",
      documents: [
        {
          id: "doc-1",
          workspaceId: "ws-1",
          name: "Main.md",
          content: "",
          contentHash: "hash",
          targetPath: null,
          fileStatus: "missing_target",
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

    const status = screen.getByTestId("sidebar-document-status-doc-1");
    expect(status).toHaveTextContent("Missing target");
    expect(status).toHaveStyle({ whiteSpace: "nowrap", flexShrink: "0" });
  });
});
