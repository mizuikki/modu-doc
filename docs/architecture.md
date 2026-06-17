# Architecture

This document describes the runtime architecture of ModuDoc after the
document-first refactor: where each concept lives, how the layers talk,
and which pipeline moves data between them.

The primary object is **Document** (a Markdown buffer edited in-app, with
an optional `target_path` bound to a real on-disk file). The project
is a pure container, fragments are a content-copy material library,
recipes are an advanced entry that one-shot-generates a document, and
snapshots are scoped per document.

## System overview

ModuDoc is a Tauri v2 desktop app. The frontend is a React + Vite
single-page UI; the backend is a Rust process embedded in the same
binary and exposed to the UI through Tauri commands and events.
Persistence spans two surfaces: a single SQLite file (the source of
truth for projects, documents, fragments, recipes, recipe items,
snapshots, and settings) and the user's filesystem (the optional
`target_path` that each document may be bound to).

The app's lifecycle is document-shaped. The user picks a project from
the sidebar, picks a document inside it, edits Markdown in a center
pane, and optionally writes the buffer to a real file on disk. Fragments
live in a side panel and are pasted into documents as content copies;
recipes are an advanced lane that one-shot-generates a brand-new
document from a saved assembly. Snapshots are taken automatically
before destructive writes and on demand per document.

Two flows matter most. The **edit flow** keeps the in-app buffer and
the database row in sync (debounced, with a per-document process
status). The **write flow** takes the in-app buffer and persists it to
the bound `target_path`, with conflict detection against any external
edit on the file. Both flows converge on a single Tauri event
(`document-status-updated`) that the frontend listens to and turns into
store updates.

The UI is laid out as a default three-column shell: sidebar (projects
+ document list), document editor (header + target bar + editor /
preview / split / history center), and a right panel (fragments /
recipes / snapshots tabs). The shell, panels, and split ratios are
configurable; zen mode, theme, and panel collapse all live in the
frontend `ui` slice and persist to `localStorage`.

## Layered architecture

```
+-----------------------------------------------------------------+
|                         Frontend (React)                        |
|  +-----------+  +---------------------+  +--------------------+ |
|  | Sidebar   |  | Document editor     |  | Right panel        | |
|  | projects|  | header / target bar |  | fragments recipes  | |
|  | documents |  | editor / preview    |  | snapshots          | |
|  +-----------+  +---------------------+  +--------------------+ |
|        |                 |                       |              |
|        +-----------------+-----------------------+              |
|                          v                                      |
|                Zustand store (AppState)                         |
|                persist: ui + active ids (localStorage)          |
+-----------------------------+-----------------------------------+
                              | tauriInvoke / events
                              v
+-----------------------------------------------------------------+
|                       Backend (Rust / Tauri)                    |
|  +-----------------+   +--------------------+   +-------------+ |
|  | commands/*      |   | services/*         |   | watcher     | |
|  | project       |   | document_path      |   | (per doc,   | |
|  | document        |   | file_writer        |   | parent dir) | |
|  | fragment        |   | snapshot / recipe  |   +-------------+ |
|  | recipe          |   | search / fragment  |                   |
|  | snapshot        |   | project          |                   |
|  | misc / settings |   +--------------------+                   |
|  +-----------------+         |                                  |
|        |                    v                                   |
|        |              sqlite pool (sqlx)                        |
+--------+-------------------------------------------------------+
         |
         v
+-----------------------------------------------------------------+
|                          Storage                                |
|  +----------------------------+  +---------------------------+  |
|  | SQLite (app data dir)      |  | Filesystem                |  |
|  | projects / documents /   |  | documents.target_path     |  |
|  | fragments / recipes /      |  | (canonical absolute path) |  |
|  | recipe_items / snapshots / |  +---------------------------+  |
|  | settings / app_meta        |                                 |
|  +----------------------------+                                 |
+-----------------------------------------------------------------+
```

The frontend never touches SQLite directly. All reads and writes go
through Tauri commands; all change notifications come back as Tauri
events (`document-status-updated` and `project-status-updated`).

## Document model and write pipeline

A `Document` is the unit the user authors. Its `content` is the
authoritative in-app Markdown buffer; `content_hash` is a stable hash
of that buffer kept in lockstep. `target_path` is the optional binding
to a real on-disk file; when set, it has already been normalized by
`services::document_path::normalize_target_path` into a canonical
absolute string (symlinks resolved, separators folded, on Windows also
lowercased).

`save_state` is the backend's view of the on-disk contract. It is
constrained at the database level to five values:
`draft | unsaved | saved | conflict | error`. The frontend
mirrors it as `DocumentSaveState`. A separate `processStatus` lives
only in the Zustand store and tracks the live edit / write / conflict
flow; it is never persisted.

The write pipeline (`write_document_to_file` -> `services::file_writer`)
runs in this order:

```
        +----------------------+
        | write_document_to_   |
        | file (Tauri command) |
        +----------+-----------+
                   |
                   v
        +----------------------+
        | load document row    |
        | (target_path, last_  |
        |  written_hash)       |
        +----------+-----------+
                   |
                   v
        +----------------------+
        | hash target on disk; |
        | if differs from last |
        | written_hash -> mark |
        | 'conflict' + emit  |
        | external_conflict    |
        +----------+-----------+
                   |
                   v
        +----------------------+
        | create parent dir;   |
        | mark_ignored hash on |
        | WatcherState         |
        +----------+-----------+
                   |
                   v
        +----------------------+
        | atomic temp + rename |
        | to target (Win32:    |
        | fallback to in-place |
        | on PermissionDenied) |
        +----------+-----------+
                   |
                   v
        +----------------------+
        | best-effort 'Before  |
        | write' snapshot      |
        | (hash de-duplicated) |
        +----------+-----------+
                   |
                   v
        +----------------------+
        | UPDATE documents     |
        | SET last_written_*,  |
        | save_state='saved'  |
        | + emit document_     |
        |   written            |
        +----------------------+
```

The frontend never constructs a `target_path`; the user picks a file
via the Tauri dialog plugin and the resulting string is fed to
`create_document` / `update_document` for normalization. The
`partial unique index` on `documents.target_path` (see schema below)
guarantees at most one live document is bound to any given path at a
time. Soft-deleting a document releases its slot by clearing
`target_path` to `NULL`.

## Watcher and conflict pipeline

A `RecommendedWatcher` from the `notify` crate is registered for every
live document with a non-null `target_path` (parent directory, non-
recursive). The set is rebuilt at boot by `prime_watchers` and patched
on document create / update / soft-delete.

When the OS reports a `Modify` or `Create` event for a watched
document's `target_path`, `handle_document_event`:

1. Reads the file content and computes its hash.
2. Skips the event if it matches the WatcherState ignore window
   (a self-induced write we just performed, within a 2-second TTL).
3. Skips the event if the file's hash matches the document's
   `last_written_hash` (a no-op touch from our own atomic rename).
4. Otherwise updates the row to `save_state = 'conflict'` and
   emits `document-status-updated` with
   `kind = "document_conflict"`.

A conflict can also be detected synchronously by
`write_document_to_file` if the hash on disk differs from
`last_written_hash` at write time; in that case the command returns
the sentinel error `"external_conflict"` and the row is left in
`save_state = 'conflict'`.

Resolution is a single command (`resolve_document_conflict`) with a
`policy` argument selected by the user from the `DocumentTargetBar`:

| Policy                 | Effect                                                    |
| ---------------------- | --------------------------------------------------------- |
| `import_external`      | Read the file, replace the document's `content` + hash,   |
|                        | leave `save_state = 'unsaved'` (still needs a write).      |
| `overwrite_external`   | Run the standard write pipeline on top of the file.      |
| `backup_and_overwrite` | Copy the file to `<name>.bak.<YYYYMMDDHHMMSS>`, then run  |
|                        | the standard write pipeline.                              |
| `cancel`               | No-op; leave both sides untouched, just clear the marker. |

All four paths emit `document-status-updated` with
`kind = "document_conflict_resolved"`, which the frontend event hook
turns into a bundle refetch.

## SQLite schema

The schema lives in `src-tauri/migrations/0001_init.sql`. It is a
clean baseline; the legacy `.agentpack` import/export tables are gone.

| Table         | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `app_meta`    | Singleton key/value (schema version, last-opened project id, etc.).        |
| `projects`  | Pure container: `id`, `name`, `created_at`, `updated_at`.                   |
| `documents`   | Primary object: `content`, `content_hash`, optional `target_path`,           |
|               | `save_state`, `last_written_at` / `last_written_hash`, `sort_order`,        |
|               | `deleted_at`, `description`.                                                |
| `fragments`   | Project-scoped material library: `name`, `content`, `tags` (JSON string), |
|               | `category`, `sort_order`, `deleted_at`.                                     |
| `recipes`     | Advanced entry: `name`, `description`, `deleted_at`.                        |
| `recipe_items`| Ordered list of fragment references per recipe: `enabled` flag,             |
|               | `sort_order`.                                                               |
| `snapshots`   | Per-document point-in-time capture: `label`, `content`, `content_hash`.     |
| `settings`    | Generic key/value settings.                                                 |

`documents.save_state` is constrained by a `CHECK` clause to the
five-value enum (`draft`, `unsaved`, `saved`, `conflict`,
`error`); any other value is rejected at the database layer.

```sql
CHECK (
  save_state IN ('draft', 'unsaved', 'saved', 'conflict', 'error')
)
```

`documents.target_path` carries a **partial unique index** so that at
most one live document can be bound to a given on-disk path:

```sql
CREATE UNIQUE INDEX idx_documents_target_path_unique
  ON documents(target_path)
  WHERE target_path IS NOT NULL;
```

Soft delete releases the slot by setting `target_path = NULL`, which
exits the partial index; the next claim on the same path succeeds.

Supporting indexes cover the read patterns the UI uses:
`documents(project_id, deleted_at, sort_order, created_at)`,
`fragments(project_id, deleted_at, sort_order, created_at)`,
`recipes(project_id, deleted_at, created_at)`,
`recipe_items(recipe_id, sort_order)`, and
`snapshots(document_id, created_at DESC)`.

## Tauri command surface

Commands are registered in `src-tauri/src/app.rs` and live under
`src-tauri/src/commands/`. Errors are normalized to a small set of
string codes (`external_conflict`, `target_missing`,
`target_not_writable`, `invalid_target_path`, `database_error`, ...).

| Domain      | Command                              | Purpose                                                  |
| ----------- | ------------------------------------ | -------------------------------------------------------- |
| Project   | `list_projects`                    | All projects, ordered by created_at.                   |
| Project   | `create_project`                   | New project + first `Untitled.md` document.            |
| Project   | `update_project`                   | Rename a project.                                      |
| Project   | `delete_project`                   | Delete a project (cascades).                           |
| Project   | `load_project`                     | Hydration bundle (project + documents + fragments +    |
|             |                                      | recipes + recipe_items + snapshots-by-document).          |
| Document    | `create_document`                    | New document; normalizes `target_path` if provided.      |
| Document    | `update_document`                    | Mutate name / content / target_path / description.       |
| Document    | `soft_delete_document`               | Set `deleted_at`, release `target_path` slot.            |
| Document    | `restore_document`                   | Clear `deleted_at`.                                      |
| Document    | `delete_document_permanently`        | Hard delete; optionally removes the file on disk.        |
| Document    | `reorder_documents`                  | Rewrite `sort_order` for the project.                  |
| Document    | `write_document_to_file`             | The write pipeline (see above).                          |
| Document    | `check_document_conflict`            | Hash the on-disk file; return has_conflict + hash.       |
| Document    | `resolve_document_conflict`          | Apply one of the four resolution policies.               |
| Fragment    | `create_fragment`                    | New material entry.                                      |
| Fragment    | `update_fragment`                    | Mutate name / content / tags / category.                 |
| Fragment    | `soft_delete_fragment`               | Set `deleted_at`.                                        |
| Fragment    | `restore_fragment`                   | Clear `deleted_at`.                                      |
| Recipe      | `create_recipe`                      | New advanced recipe.                                     |
| Recipe      | `update_recipe_items`                | Replace the ordered list of items in one transaction.   |
| Recipe      | `generate_document_from_recipe`      | One-shot: create a new document from enabled items.      |
| Recipe      | `insert_recipe_into_document`        | Splice the recipe content into a document at a cursor.   |
| Recipe      | `replace_document_with_recipe`       | Prepend recipe content; keep existing content below.     |
| Snapshot    | `create_snapshot`                    | Capture current content (no-op if hash unchanged).       |
| Snapshot    | `list_document_snapshots`            | All snapshots for a document.                            |
| Snapshot    | `restore_snapshot`                   | Overwrite in place OR create `name (Restored)` sibling.  |
| Misc        | `search_project_content`           | Cross-entity substring search (projects / documents /  |
|             |                                      | fragments / recipes / snapshots).                        |
| Misc        | `open_target_in_file_manager`        | Reveal a document's `target_path` in the OS file manager.|
| Misc        | `debug_log_frontend`                 | Mirror a frontend log line into the Rust debug log.      |
| Settings    | `get_setting` / `set_setting` /      | Generic key/value store (theme, language, etc.).         |
|             | `list_settings` / `delete_setting`   |                                                          |

## Frontend store shape

The store is a single Zustand slice with a `persist` middleware that
writes only `ui`, `activeProjectId`, and `activeDocumentId` to
`localStorage` under the key `modudoc-app-store`. The full shape lives
in `src/store/types.ts`; the runtime is `src/store/appStore.ts`.

| Field                       | Persisted? | Notes                                                  |
| --------------------------- | ---------- | ------------------------------------------------------ |
| `projects`                | no         | Re-hydrated from `load_project`.                     |
| `activeProjectId`         | yes        |                                                        |
| `documents`                 | no         | Re-hydrated from `load_project`.                     |
| `activeDocumentId`          | yes        |                                                        |
| `fragments`                 | no         | Re-hydrated.                                           |
| `recipes` / `recipeItems`   | no         | Re-hydrated.                                           |
| `snapshotsByDocumentId`     | no         | Re-hydrated, grouped by `document_id`.                 |
| `selectedSnapshotId`        | no         | Defaults to most recent snapshot of the active doc.    |
| `documentDrafts`            | **no**     | Per-doc in-flight buffer; lost on reload.              |
| `documentProcessStatus`     | **no**     | Per-doc live status; never persisted.                  |
| `documentStatusMessage`     | **no**     | Per-doc human-readable message; never persisted.       |
| `ui`                        | yes        | Theme, center mode, panel widths, zen mode, tabs, etc. |

`documentDrafts`, `documentProcessStatus`, and `documentStatusMessage`
are explicitly reset to their initial values by both `hydrate(...)`
and `loadProjectBundle(...)`. They exist only to bridge in-flight
edits and the live write flow; on reload the bundle is re-fetched and
the runtime map starts clean.

## State events

Two Tauri events drive the frontend.

### `document-status-updated` (per-document)

The single source of truth for document state changes. Payload:

```
{ kind: string, project_id?: string, document_id?: string }
```

`kind` values seen in the codebase include `document_created`,
`document_updated`, `document_target_updated`, `document_deleted`,
`document_restored`, `document_reordered`, `document_written`,
`document_writing_failed`, `document_conflict`,
`document_conflict_resolved`, `snapshot_created`, `snapshot_restored`,
`fragment_created`, `fragment_updated`, `fragment_deleted`,
`fragment_restored`, `recipe_created`, `recipe_updated`. The frontend
event hook (in `src/app/hooks/useProjectStatusEvents.ts`) treats a
fixed allowlist of these as "refresh the bundle" triggers; the rest
are advisory.

### `project-status-updated` (project lifecycle)

Used only for project-level lifecycle (`project_created`,
`project_updated`, `project_deleted`) so the sidebar and project
switcher can refresh. The `document-status-updated` event already
carries a `project_id`, so per-document flows do not also emit this.

## Folder layout

```
modu-doc/
  src/                        React + Vite frontend
    app/                      Shell, routing, hooks (bootstrap, events, shortcuts)
    features/
      documents/              DocumentEditor, DocumentList, DocumentHeader,
                              DocumentTargetBar, DocumentPreview, EditorPane,
                              RightPanel, useSaveDocument
      fragments/              Fragment library UI (right panel)
      recipes/                Recipe editor + advanced entry
      projects/             Project switcher, settings dialog
      search/                 Cross-entity search UI
      help/                   Keyboard cheatsheet
      history/                Per-document snapshot timeline + diff
      sync/                   Conflict banner + status badge
    components/               Shared UI primitives
    lib/
      api/                    Typed Tauri command wrappers (documents,
                              projects, fragments, recipes, snapshots,
                              sync, search, tauri, errors, types)
      markdownPreview.ts      Markdown -> HTML
      syncScheduler.ts        Debounce + flush for drafts
      projectWrite.ts       Helper for the write flow
    i18n/                     en.json / zh.json (key sets kept identical)
    store/                    Zustand store (types, appStore, selectors,
                              activation, defaults, loadState)
    test/                     Vitest setup
  src-tauri/                  Tauri v2 Rust backend
    src/
      app.rs                  Tauri builder, plugin registration, handler list
      main.rs                 Process entry
      db.rs                   SQLite pool, migrations, content_hash, now_iso
      error.rs                AppErrorCode + normalize_error
      types.rs                Wire types (Project, Document, Fragment, ...)
      commands/               Tauri command implementations
        mod.rs                Event payload types, emit helpers
        projects.rs
        documents.rs
        fragments.rs
        recipes.rs
        snapshots.rs
        search.rs
        misc.rs
        settings.rs
        debug.rs
      services/               Domain logic used by commands
        project.rs          validate_target_path, probe_writable
        document_path.rs      normalize_target_path (canonicalize)
        file_writer.rs        atomic write + WatcherState coordination
        watcher.rs            Per-document RecommendedWatcher
        snapshot.rs           create_for_document (Before write)
        fragment.rs           next_sort_order
        recipe.rs
        search.rs             SearchService
      migrations/             0001_init.sql baseline
  e2e-tests/                  WebdriverIO e2e suite
    test/
      specs/                  *.ts specs
      support/                Shared helpers, page objects
    wdio.conf.ts
  scripts/                    Node helpers (e2e setup, third-party notices)
  docs/                       architecture.md, state-model.md, testing.md, release.md
  tools/                      Local developer tooling
```

## Testing strategy

Three layers, each run independently.

### Rust unit tests (`cargo test`)

Pure-logic tests live next to the code under test inside `#[cfg(test)]`
modules. They use `sqlx::SqlitePool` against an in-memory SQLite with
`migrations` applied, or `tempfile::tempdir()` for filesystem-bound
cases. Coverage targets the contract that matters most: path
normalization, conflict detection at write time, watcher event
filtering, soft-delete releases the `target_path` unique slot,
fragment tags round-trip through the JSON column, recipe concatenation
honors the `enabled` flag.

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### Frontend unit tests (`pnpm test`)

Vitest + Testing Library, deterministic (no timing-based flake).
Lives next to source as `*.test.ts` / `*.test.tsx`. Common targets:
store hydration and `loadProjectBundle` round-trip, selector
behavior, markdown preview rendering, i18n key parity between
`en.json` and `zh.json`.

```bash
pnpm test
```

### End-to-end tests (`pnpm run e2e`)

WebdriverIO suite under `e2e-tests/`. Drives the real desktop app
through the document-first flows: project creation, document CRUD,
the three-column shell, the write flow, and conflict resolution.
Setup is one-time per machine (`pnpm run e2e:setup`); on Linux without
a display use `pnpm run e2e:xvfb`. Set `MODUDOC_E2E_MODE=dev` to run
against the Vite dev server; the default runs against the built
frontend. The dedicated perf spec is `pnpm run e2e:perf`.

### Pre-PR gate

Run all of the following before opening a PR:

```bash
pnpm run check        # Biome lint + format check
pnpm run typecheck    # tsc --noEmit
pnpm test             # Vitest
pnpm run build        # typecheck + Vite
cargo test --manifest-path src-tauri/Cargo.toml
pnpm run notice:check # third-party notices are in sync
```
