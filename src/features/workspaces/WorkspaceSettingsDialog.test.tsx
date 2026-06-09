import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";

const { updateWorkspace } = vi.hoisted(() => ({
  updateWorkspace: vi.fn(async () => ({
    id: "workspace-a",
    name: "Workspace A",
    created_at: "t",
    updated_at: "t",
  })),
}));

vi.mock("@/lib/api/workspaces", () => ({
  updateWorkspace,
}));

describe("WorkspaceSettingsDialog", () => {
  beforeEach(() => {
    updateWorkspace.mockClear();
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
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits trimmed name via updateWorkspace without a target path", async () => {
    render(
      <AppTestProviders>
        <WorkspaceSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("workspace-settings-open"));

    const nameInput = await screen.findByLabelText(/workspace name/i);
    fireEvent.change(nameInput, { target: { value: "  New Name  " } });

    fireEvent.click(screen.getByTestId("workspace-settings-save"));

    await waitFor(() => {
      expect(updateWorkspace).toHaveBeenCalledWith({
        id: "workspace-a",
        name: "New Name",
      });
    });
  });

  it("falls back to a null name when the input is blank", async () => {
    render(
      <AppTestProviders>
        <WorkspaceSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("workspace-settings-open"));

    const nameInput = await screen.findByLabelText(/workspace name/i);
    fireEvent.change(nameInput, { target: { value: "   " } });

    fireEvent.click(screen.getByTestId("workspace-settings-save"));

    await waitFor(() => {
      expect(updateWorkspace).toHaveBeenCalledWith({
        id: "workspace-a",
        name: null,
      });
    });
  });

  it("does not render a target file input", async () => {
    render(
      <AppTestProviders>
        <WorkspaceSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("workspace-settings-open"));

    expect(screen.queryByLabelText(/target file/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-settings-target")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-settings-choose")).not.toBeInTheDocument();
  });
});
