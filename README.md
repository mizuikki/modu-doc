# ModuDoc

<p align="center">
  <img src="./src/assets/modudoc-logo.png" alt="ModuDoc logo" width="160" height="160" />
</p>

<p align="center">
  <a href="https://github.com/mizuikki/modu-doc/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/mizuikki/modu-doc/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24c8db.svg" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb.svg" />
</p>

ModuDoc is a local-first desktop app for writing Markdown documents backed by a reusable content library. Edit each document in-app, optionally bind it to a real on-disk `.md` file, and reuse fragments across many documents without duplicating content.

## Overview

ModuDoc is designed for people who maintain structured Markdown documents that need to be assembled from repeatable sections: agent instructions, project docs, templates, checklists, prompts, and other living documents.

The primary object is the **Document**. Each document is a Markdown file edited in-app, with an optional `target_path` that binds it to a real on-disk file. A workspace is a pure container that groups documents together. Fragments are a content-copy material library available across the workspace. Recipes are an advanced entry that one-shot-generates a document from a chosen fragment set. Snapshots are per-document, not per-workspace.

Data lives in a local SQLite database. The app detects external edits to bound files and offers four conflict-resolution policies: `import_external`, `overwrite_external`, `backup_and_overwrite`, and `cancel`. Document processing state (`process_status`) is tracked in the frontend store only and is never persisted.

## Features

- Local-first workspaces backed by SQLite, with Markdown documents as the primary object.
- In-app Markdown editor and live preview per document.
- Per-document `target_path` binding to any `.md` file on disk.
- Per-document `file_status` with conflict detection and four resolution policies (`import_external`, `overwrite_external`, `backup_and_overwrite`, `cancel`).
- `write_document_to_file` flow for safe writes with external-change awareness.
- Per-document snapshots for reviewing and restoring prior content.
- Fragment library: reusable Markdown sections that are copied into documents on use.
- Recipes (advanced): one-shot document generation from a curated fragment set.
- Three-column default layout: sidebar, document editor, right panel.
- Global search across workspaces, documents, fragments, and snapshots.
- English and Chinese UI localization.
- Cross-platform desktop packaging through Tauri v2.

## Getting Started

Desktop installers are published from GitHub Releases when release builds are available:

<https://github.com/mizuikki/modu-doc/releases>

To run ModuDoc from source:

```bash
git clone https://github.com/mizuikki/modu-doc.git
cd modu-doc
corepack enable pnpm
pnpm install
pnpm run tauri:dev
```

## Requirements

For development, install:

- Node.js 24 or newer recommended.
- Rust 1.95 or newer.
- Tauri v2 system dependencies for your operating system.

See the official Tauri prerequisites for platform-specific setup:

<https://v2.tauri.app/start/prerequisites/>

## Development

Start the frontend-only Vite server:

```bash
pnpm run dev
```

Start the full Tauri desktop app:

```bash
pnpm run tauri:dev
```

## Localization (i18n)

ModuDoc uses `i18next` + `react-i18next` for UI localization.

- Translation resources live in `src/i18n/locales/en.json` and `src/i18n/locales/zh.json`.
- Initialization lives in `src/i18n/i18n.ts` and detects the language in this order:
  1. `localStorage` (key: `i18nextLng`)
  2. System/browser language (`navigator`)
  3. Fallback to English (`en`)
- When adding new strings, update `en.json` first and keep `zh.json` in sync. The test
  `src/i18n/locales.test.ts` enforces identical key sets.

Build the frontend:

```bash
pnpm run build
```

Build desktop bundles:

```bash
pnpm run tauri:build
```

## Quality Checks

Run the main project checks before opening a pull request:

```bash
pnpm run check
pnpm run check:fix # applies safe auto-fixes
pnpm run typecheck
pnpm test # vitest run
cargo test --manifest-path src-tauri/Cargo.toml
pnpm run notice:check
```

Formatting only (no linting). These commands may fail if formatting differs from Biome rules:

```bash
pnpm run format:check
pnpm run format
```

End-to-end tests are available through WebdriverIO:

```bash
pnpm run e2e:setup
pnpm run e2e
```

For Milkdown and UI performance diagnostics, run the dedicated perf spec:

```bash
pnpm run e2e:perf
```

By default, e2e runs the Tauri app against built frontend assets (`frontendDist`) and does not start a Vite dev server. To run e2e against the Vite dev server instead, set `MODUDOC_E2E_MODE=dev`.

On Linux, you can also run e2e tests inside a virtual display to avoid bringing the app window to the foreground:

```bash
pnpm run e2e:xvfb
```

If you're on Wayland, `pnpm run e2e:xvfb` forces the X11 backend (`GDK_BACKEND=x11`) and unsets `WAYLAND_DISPLAY` so the app attaches to the virtual X server instead of the real Wayland session.

By default, each e2e run writes runner logs under `tmp/modudoc-e2e/run-*/logs/` and automatically keeps only the most recent 3 runs.

The performance spec writes its JSON report under `tmp/modudoc-e2e/run-*/perf/` by default. You can adjust sampling with `MODUDOC_E2E_PERF_ITERATIONS` and `MODUDOC_E2E_PERF_WARMUP`, or override the report directory with `MODUDOC_E2E_PERF_OUTPUT`.

If you need to avoid WebDriver port conflicts with other projects, you can override the ports used by `tauri-driver`/WebdriverIO via `MODUDOC_E2E_WD_PORT` and `MODUDOC_E2E_WD_NATIVE_PORT`.

On Windows, e2e requires `tauri-driver` and `msedgedriver.exe` (Edge WebDriver). The runner will:

- Use `TAURI_DRIVER_PATH` if set; otherwise it will try to locate `tauri-driver` on PATH, and finally fall back to building the vendored driver in `tools/tauri-driver`.
- Use `MSEDGEDRIVER_PATH` if set; otherwise it will try to locate `msedgedriver.exe` on PATH, and finally fall back to downloading a matching driver into `tmp/modudoc-e2e/drivers/`.

If you want to pre-warm these dependencies (recommended for fresh Windows environments or offline-friendly setup), run `pnpm run e2e:setup`.

The i18n locale persistence check is covered by `e2e-tests/test/specs/i18n.locale-persistence.ts`.

## Document Model

ModuDoc is structured around a small, explicit set of relationships:

```text
Workspace
  |-- Document (1..N)  -- primary object, Markdown edited in-app
  |     |-- target_path  -- optional binding to a real on-disk .md file
  |     |-- file_status   -- current sync state with the bound file
  |     `-- Snapshot (1..N) -- per-document history (not per-workspace)
  |
  |-- Fragment library  -- reusable Markdown sections, copied into documents on use
  `-- Recipe            -- advanced one-shot generator: produces a new Document
```

- **Workspace**: a pure container that groups documents. It owns the document list, the fragment library, and any recipes.
- **Document**: the primary object. Each document is Markdown content with an optional `target_path` and a `file_status` that reflects the relationship with the bound file.
- **Snapshot**: a point-in-time capture of a single document's content, stored per-document.
- **Fragment library**: a workspace-scoped content-copy library. Inserting a fragment into a document copies its text; later edits to the fragment do not retroactively change documents that already used it.
- **Recipe**: an advanced entry that one-shot-generates a new document from a chosen fragment set and configuration.
- **Write flow**: `write_document_to_file` writes the document's current content to its `target_path`. If the file changed on disk since the last read, the document's `file_status` becomes `conflicted` and the user must pick one of the four resolution policies.
- **`process_status`**: a transient, frontend-only state for the current document (e.g. saving, syncing). It lives in the frontend store and is never persisted.

Default UI is a three-column layout:

```text
+--------+----------------------------+--------------------+
|        |                            |                    |
| Side   |       Document Editor      |    Right Panel     |
| bar    |       (Markdown + prev)    |  (metadata, snap-  |
|        |                            |   shots, actions)  |
|        |                            |                    |
+--------+----------------------------+--------------------+
```

## Package Format

`.agentpack` import and export has been removed. Workspaces are local-only and backed by SQLite. To move data between machines, copy the workspace's SQLite database directly.

## Contributing

Issues and pull requests are welcome. For code changes, please keep the implementation focused, follow the existing project style, and run the relevant checks before submitting.

Useful entry points:

- Frontend app: `src/`
- Tauri backend: `src-tauri/`
- End-to-end tests: `e2e-tests/`
- CI workflow: `.github/workflows/ci.yml`

## License

ModuDoc is licensed under the [MIT License](./LICENSE).

See [NOTICE](./NOTICE) and [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt) for attribution and third-party notices.
