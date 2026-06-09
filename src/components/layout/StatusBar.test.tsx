import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StatusBar } from "@/components/layout/StatusBar";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";

describe("StatusBar", () => {
  beforeEach(() => {
    resetAppStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the zen toggle and snapshot buttons", () => {
    render(
      <AppTestProviders>
        <StatusBar />
      </AppTestProviders>,
    );
    expect(screen.getByTestId("zen-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("status-snapshot")).toBeInTheDocument();
  });

  it("computes word count from the active document", () => {
    useAppStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Test",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      activeWorkspaceId: "ws-1",
      documents: [
        {
          id: "doc-1",
          workspaceId: "ws-1",
          name: "Main",
          content: "one two three four five six",
          contentHash: "hash-1",
          targetPath: null,
          fileStatus: "ready",
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
      fragments: [
        {
          id: "f-1",
          workspaceId: "ws-1",
          name: "F1",
          content: "one two three four",
          contentHash: "",
          tags: "",
          category: null,
          sortOrder: 0,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "f-2",
          workspaceId: "ws-1",
          name: "F2",
          content: "five six",
          contentHash: "",
          tags: "",
          category: null,
          sortOrder: 1,
          deletedAt: null,
          createdAt: "t",
          updatedAt: "t",
        },
        {
          id: "f-3",
          workspaceId: "other",
          name: "F3",
          content: "should not count",
          contentHash: "",
          tags: "",
          category: null,
          sortOrder: 2,
          deletedAt: "2024-01-01T00:00:00Z",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
    });

    render(
      <AppTestProviders>
        <StatusBar />
      </AppTestProviders>,
    );

    const wordCount = screen.getByTestId("status-word-count");
    expect(wordCount.textContent).toMatch(/6/);
    const fragmentCount = screen.getByTestId("status-fragment-count");
    expect(fragmentCount.textContent).toMatch(/2/);
  });

  it("reflects zen mode from the store", () => {
    useAppStore.setState({
      ui: { ...useAppStore.getState().ui, zenMode: true },
    });
    render(
      <AppTestProviders>
        <StatusBar />
      </AppTestProviders>,
    );
    const toggle = screen.getByTestId("zen-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("disables the snapshot button when no workspace is active", () => {
    render(
      <AppTestProviders>
        <StatusBar />
      </AppTestProviders>,
    );
    const snapshot = screen.getByTestId("status-snapshot") as HTMLButtonElement;
    expect(snapshot.disabled).toBe(true);
  });

  it("formats last-written time across second/minute/hour/day buckets", () => {
    const cases: Array<{
      offsetMs: number;
      bucket: "just now" | "s ago" | "m ago" | "h ago" | "d ago";
    }> = [
      { offsetMs: 5_000, bucket: "just now" },
      { offsetMs: 50_000, bucket: "s ago" },
      { offsetMs: 5 * 60_000, bucket: "m ago" },
      { offsetMs: 3 * 60 * 60_000, bucket: "h ago" },
      { offsetMs: 2 * 24 * 60 * 60_000, bucket: "d ago" },
    ];
    for (const { offsetMs, bucket } of cases) {
      resetAppStore();
      useAppStore.setState({
        workspaces: [
          {
            id: "ws-1",
            name: "Test",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        activeWorkspaceId: "ws-1",
        documents: [
          {
            id: "doc-1",
            workspaceId: "ws-1",
            name: "Main",
            content: "body",
            contentHash: "hash",
            targetPath: "/tmp/main.md",
            fileStatus: "ready",
            lastWrittenAt: new Date(Date.now() - offsetMs).toISOString(),
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
      const { unmount } = render(
        <AppTestProviders>
          <StatusBar />
        </AppTestProviders>,
      );
      const text = document.body.textContent ?? "";
      expect(text).toContain("Last written ");
      expect(text).toContain(bucket);
      unmount();
    }
  });
});
