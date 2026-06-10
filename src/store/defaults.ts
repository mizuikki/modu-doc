import type { UiState } from "./types";

export const initialUI: UiState = {
  theme: "light",
  centerMode: "edit",
  sidebarWidth: 280,
  rightPanelWidth: 320,
  rightPanelTab: "fragments",
  rightPanelCollapsed: true,
  zenMode: false,
  cheatsheetOpen: false,
  settingsDialogOpen: false,
};

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 360;
export const RIGHT_PANEL_WIDTH_MIN = 280;
export const RIGHT_PANEL_WIDTH_MAX = 480;
