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

ModuDoc is a local-first desktop app for building Markdown documents from reusable fragments. Create small pieces of content, arrange them into recipes, preview the compiled result, and write it to any target `.md` file on your machine.

## Overview

ModuDoc is designed for people who maintain structured Markdown documents that need to be assembled from repeatable sections: agent instructions, project docs, templates, checklists, prompts, and other living documents.

Each workspace keeps its fragments, recipes, snapshots, and target-file metadata in a local SQLite database. The app can bind a workspace to an arbitrary Markdown file, detect external changes, and export or import complete workspaces as `.agentpack` archives.

## Features

- Local-first workspaces backed by SQLite.
- Markdown fragments with editing and preview support.
- Recipes for ordering fragments and enabling or disabling sections.
- One-click sync to a bound target Markdown file.
- External target-file conflict detection and resolution.
- Snapshots for reviewing and restoring compiled output.
- Global search across workspaces, fragments, recipes, and snapshots.
- `.agentpack` import and export for portable workspaces.
- English and Chinese UI localization.
- Cross-platform desktop packaging through Tauri.

## Getting Started

Desktop installers are published from GitHub Releases when release builds are available:

<https://github.com/mizuikki/modu-doc/releases>

To run ModuDoc from source:

```bash
git clone https://github.com/mizuikki/modu-doc.git
cd modu-doc
npm ci
npm run tauri:dev
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
npm run dev
```

Start the full Tauri desktop app:

```bash
npm run tauri:dev
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
npm run build
```

Build desktop bundles:

```bash
npm run tauri:build
```

## Quality Checks

Run the main project checks before opening a pull request:

```bash
npm run check
npm run check:fix # applies safe auto-fixes
npm run typecheck
npm test # vitest run
cargo test --manifest-path src-tauri/Cargo.toml
npm run notice:check
```

Formatting only (no linting). These commands may fail if formatting differs from Biome rules:

```bash
npm run format:check
npm run format
```

End-to-end tests are available through WebdriverIO:

```bash
npm run e2e:setup
npm run e2e
```

For Milkdown and UI performance diagnostics, run the dedicated perf spec:

```bash
npm run e2e:perf
```

By default, e2e runs the Tauri app against built frontend assets (`frontendDist`) and does not start a Vite dev server. To run e2e against the Vite dev server instead, set `MODUDOC_E2E_MODE=dev`.

On Linux, you can also run e2e tests inside a virtual display to avoid bringing the app window to the foreground:

```bash
npm run e2e:xvfb
```

If you're on Wayland, `npm run e2e:xvfb` forces the X11 backend (`GDK_BACKEND=x11`) and unsets `WAYLAND_DISPLAY` so the app attaches to the virtual X server instead of the real Wayland session.

By default, each e2e run writes runner logs under `tmp/modudoc-e2e/run-*/logs/` and automatically keeps only the most recent 3 runs.

The performance spec writes its JSON report under `tmp/modudoc-e2e/run-*/perf/` by default. You can adjust sampling with `MODUDOC_E2E_PERF_ITERATIONS` and `MODUDOC_E2E_PERF_WARMUP`, or override the report directory with `MODUDOC_E2E_PERF_OUTPUT`.

If you need to avoid WebDriver port conflicts with other projects, you can override the ports used by `tauri-driver`/WebdriverIO via `MODUDOC_E2E_WD_PORT` and `MODUDOC_E2E_WD_NATIVE_PORT`.

On Windows, e2e requires `tauri-driver` and `msedgedriver.exe` (Edge WebDriver). The runner will:

- Use `TAURI_DRIVER_PATH` if set; otherwise it will try to locate `tauri-driver` on PATH, and finally fall back to building the vendored driver in `tools/tauri-driver`.
- Use `MSEDGEDRIVER_PATH` if set; otherwise it will try to locate `msedgedriver.exe` on PATH, and finally fall back to downloading a matching driver into `tmp/modudoc-e2e/drivers/`.

If you want to pre-warm these dependencies (recommended for fresh Windows environments or offline-friendly setup), run `npm run e2e:setup`.

The i18n locale persistence check is covered by `e2e-tests/test/specs/i18n.locale-persistence.ts`.

## Package Format

ModuDoc workspaces can be exported as `.agentpack` files. An `.agentpack` file is a ZIP archive that contains the workspace manifest, fragments, recipes, snapshots, and reserved asset storage.

Current top-level layout:

```text
workspace.json
fragments.json
recipes.json
snapshots/
assets/
```

Imported packages create a new workspace. Any exported target path is treated as a hint only, so imported workspaces do not automatically write to the original target file.

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
