import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

const { updateProject } = vi.hoisted(() => ({
  updateProject: vi.fn(async () => ({
    id: "project-a",
    name: "Project A",
    created_at: "t",
    updated_at: "t",
  })),
}));

vi.mock("@/lib/api/projects", () => ({
  updateProject,
}));

describe("ProjectSettingsDialog", () => {
  beforeEach(() => {
    updateProject.mockClear();
    resetAppStore();
    useAppStore.setState({
      projects: [
        {
          id: "project-a",
          name: "Project A",
          createdAt: "t",
          updatedAt: "t",
        },
      ],
      activeProjectId: "project-a",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits trimmed name via updateProject without a target path", async () => {
    render(
      <AppTestProviders>
        <ProjectSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("project-settings-open"));

    const nameInput = await screen.findByLabelText(/project name/i);
    fireEvent.change(nameInput, { target: { value: "  New Name  " } });

    fireEvent.click(screen.getByTestId("project-settings-save"));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith({
        id: "project-a",
        name: "New Name",
      });
    });
  });

  it("falls back to a null name when the input is blank", async () => {
    render(
      <AppTestProviders>
        <ProjectSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("project-settings-open"));

    const nameInput = await screen.findByLabelText(/project name/i);
    fireEvent.change(nameInput, { target: { value: "   " } });

    fireEvent.click(screen.getByTestId("project-settings-save"));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith({
        id: "project-a",
        name: null,
      });
    });
  });

  it("does not render a target file input", async () => {
    render(
      <AppTestProviders>
        <ProjectSettingsDialog />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByTestId("project-settings-open"));

    expect(screen.queryByLabelText(/target file/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-settings-target")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-settings-choose")).not.toBeInTheDocument();
  });
});
