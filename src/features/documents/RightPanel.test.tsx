import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RightPanel } from "@/features/documents/RightPanel";
import { useAppStore } from "@/store/appStore";
import { resetAppStore } from "@/test/testUtils";

describe("RightPanel", () => {
  beforeEach(() => {
    resetAppStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a stable collapsed trigger structure", () => {
    useAppStore.setState({
      ui: {
        ...useAppStore.getState().ui,
        rightPanelCollapsed: true,
      },
    });

    render(<RightPanel />);

    const trigger = screen.getByRole("button", { name: "Open panel" });
    expect(trigger).toHaveClass("right-panel-collapsed-trigger");
    expect(screen.getByText("Open panel")).toHaveClass("right-panel-collapsed-label");
  });
});
