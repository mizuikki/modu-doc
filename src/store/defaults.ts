import type { UiState } from "./types";

export const initialUI: UiState = {
  theme: "light",
  centerMode: "edit",
  sidebarWidth: 220,
  rightPanelWidth: 320,
  rightPanelTab: "fragments",
  rightPanelCollapsed: true,
  zenMode: false,
  cheatsheetOpen: false,
  settingsDialogOpen: false,
};

export const SIDEBAR_WIDTH_MIN = 176;
export const SIDEBAR_WIDTH_MAX = 320;
export const RIGHT_PANEL_WIDTH_MIN = 280;
export const RIGHT_PANEL_WIDTH_MAX = 480;
