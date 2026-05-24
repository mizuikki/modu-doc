# Store State Model

This document summarizes the frontend store state model and how it maps to backend events.

## Core concepts

- `workspaces[].status` (file state): persisted per-workspace status from the backend (`ready`, `dirty`, `conflicted`, `error`, `missing_target`).
- `compileStatus` (UI process state): transient UI status for the current editing/sync flow (`editing`, `saving`, `synced`, `error`, `conflicted`, etc.).
- `workspaceStatusMessage` (event/notice): last backend event code received via `workspace-status-updated` (used for user-facing messaging and status banners).
- User-facing errors: shown via toasts and dialogs; developer diagnostics use the optional debug logs.

## Loading responsibilities

- `hydrate(...)`: initial boot hydration. Loads the workspace bundle and resets transient UI state (`compileStatus`, `workspaceStatusMessage`, editor drafts).
- `loadWorkspaces(...)`: replaces the loaded bundle while preserving transient UI state (used for non-boot reload paths).

## Event flow (high level)

- Backend emits `workspace-status-updated` with `{ kind, workspace_id }`.
- Frontend listens in `src/app/hooks/useWorkspaceStatusEvents.ts` and:
  - updates `workspaceStatusMessage` (for display),
  - updates `compileStatus` (for UI state),
  - updates `workspaces[].status` for the affected workspace (or triggers a list refresh when needed).

## Debug logging

This project has two separate debug switches (frontend + backend).

### Frontend (browser console)

- Enable:
  - Run in DevTools console: `localStorage.setItem("modudoc.debug", "1")`
  - Reload the app window
- Disable:
  - `localStorage.removeItem("modudoc.debug")` (or set it to `"0"`)

### Backend (Rust stderr)

Set `MODUDOC_DEBUG` before launching the app.

- macOS/Linux:
  - `MODUDOC_DEBUG=1 npm run tauri:dev`
- Windows (PowerShell):
  - `$env:MODUDOC_DEBUG="1"; npm run tauri:dev`
