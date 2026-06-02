import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KeyboardCheatsheet } from "@/features/help/KeyboardCheatsheet";
import { useAppStore } from "@/store/appStore";
import { AppTestProviders, resetAppStore } from "@/test/testUtils";

describe("KeyboardCheatsheet", () => {
  beforeEach(() => {
    resetAppStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders when cheatsheetOpen is true", () => {
    useAppStore.setState({
      ui: { ...useAppStore.getState().ui, cheatsheetOpen: true },
    });
    render(
      <AppTestProviders>
        <KeyboardCheatsheet />
      </AppTestProviders>,
    );
    expect(screen.getByTestId("keyboard-cheatsheet")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-search")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-save")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-snapshot")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-zen")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-palette")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-cheatsheet")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-escape")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-navigate")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-cheatsheet-row-switch-fragment")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <AppTestProviders>
        <KeyboardCheatsheet />
      </AppTestProviders>,
    );
    expect(screen.queryByTestId("keyboard-cheatsheet")).not.toBeInTheDocument();
  });

  it("opens on '?' key when not in an input field", () => {
    render(
      <AppTestProviders>
        <KeyboardCheatsheet />
      </AppTestProviders>,
    );
    expect(useAppStore.getState().ui.cheatsheetOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    });
    expect(useAppStore.getState().ui.cheatsheetOpen).toBe(true);
  });

  it("ignores '?' key when focus is inside an input", () => {
    render(
      <AppTestProviders>
        <div>
          <input data-testid="dummy-input" />
          <KeyboardCheatsheet />
        </div>
      </AppTestProviders>,
    );
    const input = screen.getByTestId("dummy-input") as HTMLInputElement;
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });
    expect(useAppStore.getState().ui.cheatsheetOpen).toBe(false);
  });

  it("closes via the Esc trigger", () => {
    useAppStore.setState({
      ui: { ...useAppStore.getState().ui, cheatsheetOpen: true },
    });
    render(
      <AppTestProviders>
        <KeyboardCheatsheet />
      </AppTestProviders>,
    );
    fireEvent.click(screen.getByTestId("keyboard-cheatsheet-close"));
    expect(useAppStore.getState().ui.cheatsheetOpen).toBe(false);
  });
});
