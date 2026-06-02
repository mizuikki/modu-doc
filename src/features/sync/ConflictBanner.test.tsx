import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { ConflictBanner } from "./ConflictBanner";

const { writeTargetFile } = vi.hoisted(() => ({
  writeTargetFile: vi.fn(async () => undefined),
}));

const { updateWorkspace } = vi.hoisted(() => ({
  updateWorkspace: vi.fn(async () => ({
    id: "workspace-a",
    name: "Workspace A",
    target_path: "/tmp/example.md",
    default_recipe_id: null,
    status: "dirty",
    last_compiled_at: null,
    last_compiled_hash: null,
    created_at: "t",
    updated_at: "t",
  })),
}));

vi.mock("@/lib/api/sync", () => ({
  writeTargetFile,
}));

vi.mock("@/lib/api/workspaces", () => ({
  updateWorkspace,
}));

describe("ConflictBanner", () => {
  beforeEach(() => {
    writeTargetFile.mockClear();
    updateWorkspace.mockClear();
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

  it("opens settings dialog at sync section on choose target", async () => {
    useAppStore.setState({
      compileStatus: "error",
      workspaceStatusMessage: "target_missing",
    });

    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("conflict-choose-target"));

    const syncNav = await screen.findByTestId("workspace-settings-nav-sync");
    expect(syncNav.dataset.active).toBe("true");
    const autoSync = await screen.findByTestId("workspace-settings-auto-sync");
    expect(autoSync).toBeTruthy();
  });

  it("persists target path from the settings dialog general section", async () => {
    useAppStore.setState({
      compileStatus: "error",
      workspaceStatusMessage: "target_missing",
    });

    render(
      <AppTestProviders>
        <ConflictBanner />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("conflict-choose-target"));

    const generalNav = await screen.findByTestId("workspace-settings-nav-general");
    fireEvent.click(generalNav);

    const targetInput = await screen.findByTestId("workspace-settings-target");
    fireEvent.change(targetInput, { target: { value: "/tmp/rebound.md" } });

    fireEvent.click(screen.getByTestId("workspace-settings-save"));

    await waitFor(() => {
      expect(updateWorkspace).toHaveBeenCalledWith({
        id: "workspace-a",
        name: "Workspace A",
        targetPath: "/tmp/rebound.md",
        clearTargetPath: false,
      });
    });
  });
});
