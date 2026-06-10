import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { FragmentEditor } from "./FragmentEditor";

vi.mock("./MilkdownEditor", () => ({
  MilkdownEditor: ({
    documentId,
    value,
    onChange,
  }: {
    documentId: string;
    value: string;
    onChange: (nextValue: string) => void;
  }) => (
    <textarea
      data-testid="fragment-editor"
      data-document-id={documentId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const { updateFragment } = vi.hoisted(() => ({
  updateFragment: vi.fn(async () => ({
    id: "fragment-a",
    project_id: "project-a",
    name: "Intro",
    content: "Updated body",
    content_hash: "",
    tags: "[]",
    category: null,
    sort_order: 0,
    deleted_at: null,
    created_at: "t",
    updated_at: "t",
  })),
}));

vi.mock("@/lib/api/fragments", () => ({
  updateFragment,
}));

const fragmentA = {
  id: "fragment-a",
  projectId: "project-a",
  name: "Intro",
  content: "Initial body",
  contentHash: "",
  tags: "[]",
  category: null,
  sortOrder: 0,
  deletedAt: null,
  createdAt: "t",
  updatedAt: "t",
};

const fragmentB = {
  ...fragmentA,
  id: "fragment-b",
  name: "Outro",
  content: "Second body",
  sortOrder: 1,
};

describe("FragmentEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateFragment.mockClear();
    resetAppStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does not save on initial mount", async () => {
    render(
      <AppTestProviders>
        <FragmentEditor fragment={fragmentA} />
      </AppTestProviders>,
    );

    await vi.advanceTimersByTimeAsync(900);
    expect(updateFragment).not.toHaveBeenCalled();
  });

  it("auto-saves drafts after a debounce", async () => {
    render(
      <AppTestProviders>
        <FragmentEditor fragment={fragmentA} />
      </AppTestProviders>,
    );

    const textbox = screen.getByTestId("fragment-editor");
    fireEvent.change(textbox, { target: { value: "Updated body" } });

    await vi.advanceTimersByTimeAsync(900);

    expect(updateFragment).toHaveBeenCalledWith({
      id: "fragment-a",
      content: "Updated body",
    });
  });

  it("rebinds the editor when the fragment prop changes", () => {
    const { rerender } = render(
      <AppTestProviders>
        <FragmentEditor fragment={fragmentA} />
      </AppTestProviders>,
    );

    const firstEditor = screen.getByTestId("fragment-editor");
    expect(firstEditor).toHaveAttribute("data-document-id", "fragment-a");
    expect(firstEditor).toHaveValue("Initial body");

    rerender(
      <AppTestProviders>
        <FragmentEditor fragment={fragmentB} />
      </AppTestProviders>,
    );

    const secondEditor = screen.getByTestId("fragment-editor");
    expect(secondEditor).toBe(firstEditor);
    expect(secondEditor).toHaveAttribute("data-document-id", "fragment-b");
    expect(secondEditor).toHaveValue("Second body");
  });
});
