# Testing

This document describes the test layers for ModuDoc after the
document-first refactor, the five quality gates that run on every
change, and the conventions for adding new tests.

## Test Layers

ModuDoc is verified at three independent layers. Each layer is
self-contained, runs in isolation, and has its own runner.

| Layer    | Scope                                      | Runner                | Where it lives                                |
|----------|--------------------------------------------|-----------------------|-----------------------------------------------|
| Rust     | Tauri commands, services, schema           | `cargo test`          | `src-tauri/src/**/*.rs` (`#[cfg(test)] mod tests`) |
| Frontend | Store, components, selectors, API wrappers | Vitest + Testing Library | `src/**/*.test.ts(x)`                       |
| E2E      | Whole-app behaviour via WebDriver          | WebdriverIO + Mocha + tauri-driver | `e2e-tests/test/specs/*.ts`        |

The three layers are complementary. Rust tests cover backend
correctness and SQLite constraints, frontend tests cover React
components and the Zustand store, and E2E tests cover the wiring
between the two through a real Tauri runtime.

## Quality Gates

Run the five mandatory gates locally before opening a PR. The
`notice:check` gate is required only when dependencies change.

| Gate                                    | What it checks                                            | Typical runtime |
|-----------------------------------------|-----------------------------------------------------------|-----------------|
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust unit + integration tests              | tens of seconds |
| `pnpm run check`                        | Biome formatting + lint                                  | a few seconds   |
| `pnpm run typecheck`                    | `tsc --noEmit` across the frontend                       | a few seconds   |
| `pnpm test`                             | Vitest suite                                             | a few seconds   |
| `pnpm run build`                        | Typecheck + Vite production build                        | tens of seconds |
| `pnpm run notice:check` (optional)      | Third-party notices are up to date                        | a few seconds   |

The five mandatory gates are exactly what CI runs in the `frontend`
and `backend` jobs of `.github/workflows/ci.yml`. If they pass
locally, CI will pass for the same scopes.

## Frontend Tests

Frontend tests live next to the code they exercise and follow the
`*.test.ts` / `*.test.tsx` naming convention.

| Area              | Example file                                            |
|-------------------|---------------------------------------------------------|
| Store             | `src/store/appStore.test.ts`                            |
| API wrappers      | `src/lib/api/errors.test.ts`                            |
| Selectors / util  | `src/lib/markdownPreview.test.ts`                       |
| Components        | `src/components/layout/StatusBar.test.tsx`              |
| Feature modules   | `src/features/projects/MainPanel.test.tsx`            |
| Conflict UI       | `src/features/sync/ConflictBanner.test.tsx`             |

Conventions:

- Use Vitest's `describe` / `it` / `expect` API and
  `@testing-library/react` for DOM assertions.
- Keep tests deterministic. Do not rely on `setTimeout`,
  `Date.now()` deltas, or fixed `Math.random()` values.
- Use the `@/...` alias (configured in `vitest.config.ts`) for
  imports from `src/`.
- The Vitest environment is `jsdom`. Global setup runs from
  `src/test/setup.ts`.

## i18n Parity Test

`src/i18n/locales.test.ts` enforces that `en.json` and `zh.json`
share an identical key set. Adding a key to one locale without
adding it to the other fails this test. When you add a new
translation, update `src/i18n/locales/en.json` first, then mirror
the key in `src/i18n/locales/zh.json` (a separate test,
`src/i18n/icuPlural.test.ts`, exercises ICU plural rules).

## Rust Tests

Rust tests live inline at the bottom of each command or service
file in a `#[cfg(test)] mod tests { ... }` block. They are not
collected from a separate `tests/` directory.

Each test creates a fresh in-memory SQLite pool via the
`test_pool()` helper, runs the schema migrations on it, and uses
that pool as the only state for the test. The helper is defined
locally in the file under test (e.g.
`src-tauri/src/commands/recipes.rs`) and returns a
`sqlx::SqlitePool` against `sqlite::memory:`.

Categories covered:

- Command behaviour: argument validation, error mapping to the
  Tauri `Result` shape, side effects on the database.
- Service logic: business rules that do not require the Tauri
  runtime, exercised through service functions directly.
- Schema constraints: migrations apply cleanly against an empty
  database, and required indices / foreign keys are in place.

Run only the Rust tests during a backend iteration:

```
cargo test --manifest-path src-tauri/Cargo.toml
```

## E2E Tests

E2E specs live in `e2e-tests/test/specs/`. The runner is
WebdriverIO + Mocha, configured by `e2e-tests/wdio.conf.ts`.
WebdriverIO launches `tauri-driver`, which in turn launches the
built Tauri app and drives it through the WebDriver protocol.

The default mode builds the Tauri app in release mode
(`tauri build --no-bundle`) and drives that binary. The run
sequence is:

1. `pnpm run e2e:setup` once, to install WebdriverIO and the
   tauri-driver prerequisites.
2. `pnpm run e2e` to build the app, start tauri-driver, and run
   every spec under `e2e-tests/test/specs/`.
3. `pnpm run e2e:xvfb` on a headless Linux runner; it wraps the
   runner in `xvfb-run` so WebView2 / wry can render.

Two environment variables switch modes:

| Variable                | Effect                                                     |
|-------------------------|------------------------------------------------------------|
| `MODUDOC_E2E_MODE=dev`  | Run against the Vite dev server on `127.0.0.1:5173`; Tauri uses the debug profile. |
| `MODUDOC_E2E_XVFB=1`    | Force the headless X server wrapper. Already implied by `pnpm run e2e:xvfb`. |

On Windows, the runner uses a per-worker WebView2 attach
strategy; the WebView2 user-data folder is made deterministic
per run so `localStorage` (notably the i18n cache) survives
`browser.reloadSession()`.

### Spec Topics

Specs are grouped by topic and live alongside each other in
`e2e-tests/test/specs/`.

| Topic                       | Spec(s)                                                 |
|-----------------------------|---------------------------------------------------------|
| Smoke                       | `app.smoke.ts`                                          |
| Project CRUD              | `projects.delete.ts`                                  |
| Document create / edit / write | `documents.create-edit-write.ts`                     |
| External conflict           | `documents.external-conflict.ts`                        |
| Fragment library            | `fragments.delete-restore.ts`                           |
| Recipe generate document    | `recipes.generate-document.ts`                          |
| Per-document snapshots      | `history.document-snapshots.ts`                         |
| Search                      | `search.navigate-results.ts`                            |
| i18n                        | `i18n.locale-persistence.ts`                            |
| Command palette             | `ui.command-palette.ts`                                 |
| Zen mode                    | `ui.zen-mode.ts`                                        |
| Theme                       | `ui.theme-menu.ts`                                      |
| Cheatsheet                  | `ui.cheatsheet.ts`                                      |
| Settings                    | `ui.settings-categorized.ts`                            |
| File manager                | `project-preview.open-target-folder.ts`               |
| Performance (Milkdown / UI) | `perf.milkdown-diagnostics.ts`                          |

### Performance Diagnostics

`pnpm run e2e:perf` runs a single spec, `perf.milkdown-diagnostics.ts`,
which samples editor / UI timings across a warmup phase and a
fixed iteration count. JSON output lands under
`tmp/modudoc-e2e/run-*/perf/`. The sampling sizes are controlled
by `MODUDOC_E2E_PERF_ITERATIONS` and `MODUDOC_E2E_PERF_WARMUP`.

## Conventions For New Tests

- Place the test next to the code under test.
- Use one `describe` per unit and short, behaviour-named `it`
  strings.
- Stub external services at the test boundary; do not spin up a
  real Tauri runtime from Vitest, and do not hit the filesystem
  from E2E specs that can avoid it.
- For E2E specs, prefer `data-testid` selectors over CSS or text
  selectors. Reset shared UI state between tests (modals,
  dropdowns, zen mode) by relying on the `beforeTest` hook in
  `wdio.conf.ts`.
- When you add a new translation key, update `en.json` first,
  then `zh.json`; the parity test in `src/i18n/locales.test.ts`
  enforces this.
- When you add or upgrade a dependency, run
  `pnpm run notice:write` and verify `pnpm run notice:check` is
  clean.

## CI

`.github/workflows/ci.yml` defines four jobs:

| Job            | What it runs                                                    |
|----------------|-----------------------------------------------------------------|
| `frontend`     | `pnpm install --frozen-lockfile`, `pnpm run check`, `pnpm run typecheck`, `pnpm test`, `pnpm run build` |
| `backend`      | `pnpm install --frozen-lockfile`, `pnpm run notice:check`, `cargo check`, `cargo test`   |
| `e2e-linux`    | `pnpm run e2e` on `ubuntu-latest` under Xvfb                     |
| `e2e-windows`  | `pnpm run e2e` on `windows-latest` (WebView2 attach)             |
| `tauri-build`  | `pnpm run tauri:build` on push to `main` (smoke check for the desktop bundle) |

E2E jobs install `tauri-driver` via
`cargo install --path tools/tauri-driver --locked` and set
`MODUDOC_E2E_WINDOWS_STRATEGY=attach` for Linux. WebView2 driver
discovery on Windows is handled automatically via the
`edgedriver` npm package.

## Troubleshooting

| Symptom                                         | Likely cause / fix                                                                 |
|-------------------------------------------------|------------------------------------------------------------------------------------|
| `pnpm test` fails on a key that exists in one locale but not the other | i18n parity. Add the missing key to the other locale file. |
| `cargo test` cannot open a database             | Make sure the test uses `test_pool()` (in-memory) and not a file-backed path.      |
| `pnpm run e2e` cannot find tauri-driver         | Run `cargo install --path tools/tauri-driver --locked` or set `TAURI_DRIVER_PATH`.  |
| E2E specs time out on Linux runners             | Use `pnpm run e2e:xvfb`, or set `MODUDOC_E2E_XVFB=1` and re-run.                    |
| WebView2 specs leak `localStorage` between runs | Ensure `MODUDOC_E2E_RUN_DIR` is set so the user-data folder is deterministic.      |
| `pnpm run notice:check` fails                   | Run `pnpm run notice:write` to regenerate `THIRD_PARTY_NOTICES.md` and `licenses/`. |
| Biome reports formatting drift                  | Run `pnpm run check:fix` and commit the result.                                     |
