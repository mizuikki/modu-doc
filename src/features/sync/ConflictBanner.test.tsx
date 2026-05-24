import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { ConflictBanner } from "./ConflictBanner";

const { writeTargetFile } = vi.hoisted(() => ({
  writeTargetFile: vi.fn(async () => undefined),
}));

const { updateWorkspace } = vi.hoisted(() => ({
  updateWorkspace: vi.fn(async () => undefined),
}));

const { save } = vi.hoisted(() => ({
  save: vi.fn(async () => "/tmp/example.md"),
}));

vi.mock("@/lib/api/sync", () => ({
  writeTargetFile,
}));

vi.mock("@/lib/api/workspaces", () => ({
  updateWorkspace,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save,
}));

describe("ConflictBanner", () => {
  beforeEach(() => {
    writeTargetFile.mockClear();
    updateWorkspace.mockClear();
    save.mockClear();
    resetAppStore();
    useAppStore.setState({
      workspaces: [
        {
          id: "workspace-a",
          name: "Workspace A",
          targetPath: "/tmp/example.md",
          defaultRecipeId: null,
          status: "conflicted",
          lastCompiledAt: null,
          lastCompiledHash: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
      compileStatus: "conflicted",
      workspaceStatusMessage: "external_conflict",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("invokes writeTargetFile on resolve action", async () => {
    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    const importButton = screen.getByTestId("conflict-import-as-fragment");
    fireEvent.click(importButton);

    expect(writeTargetFile).toHaveBeenCalledWith({
      workspaceId: "workspace-a",
      conflictPolicy: "import_as_fragment",
    });
  });

  it("offers choose target action on target issues", async () => {
    useAppStore.setState({
      compileStatus: "error",
      workspaceStatusMessage: "target_missing",
    });

    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    const choose = screen.getByTestId("conflict-choose-target");
    fireEvent.click(choose);

    expect(save).toHaveBeenCalled();
    // async handler
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updateWorkspace).toHaveBeenCalledWith({
      id: "workspace-a",
      name: null,
      targetPath: "/tmp/example.md",
      clearTargetPath: false,
    });
  });
});
