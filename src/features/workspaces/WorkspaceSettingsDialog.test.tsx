import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";

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

const { save } = vi.hoisted(() => ({
  save: vi.fn(async () => "/tmp/next.md"),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save,
}));

vi.mock("@/lib/api/workspaces", () => ({
  updateWorkspace,
}));

describe("WorkspaceSettingsDialog", () => {
  beforeEach(() => {
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
          status: "dirty",
          lastCompiledAt: null,
          lastCompiledHash: null,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeWorkspaceId: "workspace-a",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits trimmed values via updateWorkspace", async () => {
    render(
      <AppTestProviders>
        <WorkspaceSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("workspace-settings-open"));

    const nameInput = await screen.findByLabelText(/workspace name/i);
    fireEvent.change(nameInput, { target: { value: "  New Name  " } });

    const targetInput = screen.getByLabelText(/target file/i);
    fireEvent.change(targetInput, { target: { value: "  /tmp/next.md  " } });

    fireEvent.click(screen.getByTestId("workspace-settings-save"));

    await waitFor(() => {
      expect(updateWorkspace).toHaveBeenCalledWith({
        id: "workspace-a",
        name: "New Name",
        targetPath: "/tmp/next.md",
        clearTargetPath: false,
      });
    });
  });

  it("clears target path when input is empty", async () => {
    render(
      <AppTestProviders>
        <WorkspaceSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("workspace-settings-open"));

    const targetInput = await screen.findByLabelText(/target file/i);
    fireEvent.change(targetInput, { target: { value: " " } });

    fireEvent.click(screen.getByTestId("workspace-settings-save"));

    await waitFor(() => {
      expect(updateWorkspace).toHaveBeenCalledWith({
        id: "workspace-a",
        name: "Workspace A",
        targetPath: null,
        clearTargetPath: true,
      });
    });
  });

  it("uses system dialog to choose target and writes to input", async () => {
    render(
      <AppTestProviders>
        <WorkspaceSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("workspace-settings-open"));
    fireEvent.click(await screen.findByTestId("workspace-settings-choose"));
    expect(save).toHaveBeenCalled();

    // Input updates with returned path.
    const targetInput = await screen.findByLabelText(/target file/i);
    expect((targetInput as HTMLInputElement).value).toBe("/tmp/next.md");
  });
});
