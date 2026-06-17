# Store State Model

This document summarizes the frontend store state model, the persisted SQLite
schema behind it, and how backend events flow through the UI.

The app is "document-first": the document is the primary object, the project
is a pure container, fragments are a content-copy material library, and
snapshots are scoped per document. `.agentpack` import/export has been removed;
documents are the only durable artifact a user authors.

## Core concepts

- `Project` is a pure container that groups documents, fragments, recipes,
  and snapshots. It carries no document content of its own and is identified
  by `id`, `name`, and timestamps.
- `Document` is the primary object: a Markdown buffer edited in-app, with an
  optional `target_path` that binds it to a real on-disk file. Each document
  owns its own `save_state`, `last_written_at` / `last_written_hash`, and
  snapshot history.
- `Fragment` is a reusable content-copy unit in a material library. Fragments
  are pasted into documents; edits to a fragment do not propagate into
  documents that already include it.
- `Recipe` is an advanced entry that, when triggered, one-shot-generates a
  new document by composing the enabled `recipe_items` (an ordered list of
  fragment references).
- `Snapshot` is a per-document point-in-time capture of the document's
  `content` and `content_hash`. Snapshots are scoped to a single document and
  are never project-wide.

## Persisted vs runtime state

| Layer      | Where                                        | Lives in                              |
| ---------- | -------------------------------------------- | ------------------------------------- |
| Persisted  | `projects`, `documents`, `fragments`, `recipes`, `recipe_items`, `snapshots` | SQLite (one table per entity) |
| Persisted  | Settings, app meta, last-opened project    | SQLite (`settings`, `app_meta`)       |
| Runtime    | `documentDrafts[docId]`                      | Frontend store only (lost on reload)  |
| Runtime    | `documentProcessStatus[docId]`               | Frontend store only (never persisted) |
| Runtime    | `documentStatusMessage[docId]`               | Frontend store only (never persisted) |
| Runtime    | `ui` (theme, panel widths, zen mode, etc.)   | Frontend store + `localStorage`       |

The persisted tables carry every field the UI needs to redraw after a reload:
`documents.save_state`, `documents.target_path`, `documents.last_written_*`,
`documents.content` / `content_hash`, plus the full fragment / recipe /
recipe_item / snapshot graph. The runtime maps above exist only to bridge
in-flight edits and the live write flow; on a hard reload they reset to their
initial values (`processStatus = "idle"`, no draft, no status message) and
the bundle is re-fetched.

## File status vs process status

Two parallel status vocabularies exist on purpose. `saveState` is the
authoritative on-disk state stored in SQLite; `processStatus` is the
frontend's view of an in-flight operation and is never persisted.

| State        | `saveState` (DB)         | `processStatus` (store)              |
| ------------ | ------------------------- | ------------------------------------ |
| Initial      | `draft`          | `idle`                               |
| User editing | `unsaved`                   | `editing` -> `saving`                |
| Written out  | `saved`                   | `writing` -> `synced`                |
| External edit| `conflict`              | `conflict`                         |
| Failure      | `error`                   | `error`                              |

`saveState` is set by the Rust backend in response to `update_document`,
`write_document_to_file`, and external-change detection. `processStatus` is
set by the store via `setDocumentProcessStatus(docId, status)` as the write
flow progresses. The two usually agree but are not coupled: e.g. a document
can be `saveState = saved` while `processStatus = editing` (the user has
typed since the last write).

## Event flow

The canonical edit path is per-document and uses `document-status-updated`
as the single source of truth.

1. User types in the editor -> `updateDocumentDraft(docId, content)` writes
   the buffer into `documentDrafts[docId]` and sets
   `documentProcessStatus[docId] = "editing"`.
2. Debounced flush -> `flushDocumentDraft(docId)` calls the
   `update_document` Tauri command.
3. Backend mutates the `documents` row (new `content_hash`, possibly
   `save_state = unsaved`) and emits `document-status-updated` with
   `kind = "document_updated"`.
4. `useProjectStatusEvents` receives the event and, for any kind in
   `DOC_REFRESH_KINDS` and matching the active project, calls
   `fetchProjectBundle(projectId)` to pull the fresh bundle.
5. The store is replaced; `setDocumentProcessStatus(docId, "synced")` clears
   the editing flag.

The write-to-disk path is a separate sub-flow that runs on top of the above:

- User invokes "Save to file" -> store sets
  `documentProcessStatus[docId] = "writing"`.
- Frontend calls `write_document_to_file(documentId)`.
- Backend writes content, updates `last_written_*`, sets
  `save_state = "saved"`, and emits
  `document-status-updated` with `kind = "document_written"`.
- Event listener calls `fetchProjectBundle`; store sets
  `processStatus = "synced"` and `statusMessage = null`.

## Conflict flow

External edits to `target_path` are detected via a hash check at write time.

1. User triggers `write_document_to_file`; backend computes the on-disk hash
   and compares it to `documents.last_written_hash`.
2. If the hashes differ, the command returns the sentinel error
   `"external_conflict"` (carrying the latest `external_content_hash`) and
   leaves the `documents` row in `save_state = "conflict"`.
3. The frontend catches the error, sets
   `documentProcessStatus[docId] = "conflict"` and writes a human-readable
   `documentStatusMessage[docId]` describing the divergence.
4. The user picks one of four resolution policies:
   - `import_external` - discard the in-app draft, pull the file's content
     back into the document.
   - `overwrite_external` - write the in-app draft on top of the file,
     clobbering external changes (no backup).
   - `backup_and_overwrite` - rename the existing file to a backup sibling
     and then write the in-app draft.
   - `cancel` - leave both sides untouched; the user resolves manually.
5. The frontend calls `resolve_document_conflict(documentId, policy)`; the
   backend applies the policy, clears `save_state` back to `saved` (or
   `unsaved`), and emits `document-status-updated` with
   `kind = "document_conflict_resolved"`.
6. Event listener re-fetches the bundle; the store clears
   `processStatus` and `statusMessage`.

## Persistence across reload

After a hard reload (or app restart) the following is restored from SQLite:
all projects, the active project, all documents (with `content`,
`content_hash`, `target_path`, `save_state`, `last_written_*`), all
fragments, recipes, recipe items, per-document snapshots, and persisted
settings. `save_state = conflict` survives a reload so the user can
re-enter the conflict flow at step 3 above.

The following does NOT survive a reload and is rebuilt by `hydrate(...)`:
in-memory drafts in `documentDrafts`, every `documentProcessStatus` entry
(they all reset to `"idle"`), and every `documentStatusMessage`. The UI
preferences in `ui` are persisted to `localStorage` separately and rehydrate
on boot. The right-panel tab, center mode, sidebar width, and zen mode are
preserved across reloads via the same `ui` slice; selection state such as
`activeDocumentId` and `selectedSnapshotId` is restored from SQLite
(`app_meta` + bundle).

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
  - `MODUDOC_DEBUG=1 pnpm run tauri:dev`
- Windows (PowerShell):
  - `$env:MODUDOC_DEBUG="1"; pnpm run tauri:dev`
