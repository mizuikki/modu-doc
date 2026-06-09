import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { ConflictBanner } from "./ConflictBanner";

const { resolveDocumentConflict, writeDocumentToFile } = vi.hoisted(() => ({
  resolveDocumentConflict: vi.fn(async () => ({
    id: "doc-a",
    workspace_id: "workspace-a",
    name: "Main",
    content: "Updated body",
    content_hash: "",
    target_path: "/tmp/example.md",
    file_status: "ready",
    last_written_at: "t",
    last_written_hash: "h",
    sort_order: 0,
    deleted_at: null,
    description: null,
    created_at: "t",
    updated_at: "t",
  })),
  writeDocumentToFile: vi.fn(async () => undefined),
}));

vi.mock("@/lib/api/documents", () => ({
  resolveDocumentConflict,
  writeDocumentToFile,
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  softDeleteDocument: vi.fn(),
  restoreDocument: vi.fn(),
  deleteDocumentPermanently: vi.fn(),
  reorderDocuments: vi.fn(),
  checkDocumentConflict: vi.fn(),
}));

describe("ConflictBanner", () => {
  beforeEach(() => {
    resolveDocumentConflict.mockClear();
    writeDocumentToFile.mockClear();
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-a",
          name: "Workspace A",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
      documents: [
        {
          id: "doc-a",
          workspaceId: "workspace-a",
          name: "Main",
          content: "Body",
          contentHash: "",
          targetPath: "/tmp/example.md",
          fileStatus: "conflicted",
          lastWrittenAt: null,
          lastWrittenHash: null,
          sortOrder: 0,
          deletedAt: null,
          description: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeDocumentId: "doc-a",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when the active document is not conflicted", () => {
    useAppStore.setState((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === "doc-a" ? { ...doc, fileStatus: "ready" } : doc,
      ),
    }));

    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    expect(screen.queryByTestId("conflict-banner")).toBeNull();
  });

  it("invokes resolveDocumentConflict for the import policy", async () => {
    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("conflict-import-as-fragment"));

    expect(resolveDocumentConflict).toHaveBeenCalledWith({
      id: "doc-a",
      policy: "import_external",
    });
  });

  it("writes the document back to the file when overwriting", async () => {
    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("conflict-overwrite-target"));

    await waitFor(() => {
      expect(resolveDocumentConflict).toHaveBeenCalledWith({
        id: "doc-a",
        policy: "overwrite_external",
      });
      expect(writeDocumentToFile).toHaveBeenCalledWith("doc-a");
    });
  });

  it("does not call writeDocumentToFile for import_external", async () => {
    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("conflict-import-as-fragment"));
    expect(writeDocumentToFile).not.toHaveBeenCalled();
  });
});
