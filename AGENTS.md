# AGENTS.md

This file provides shared repository guidance for AI coding assistants and automation agents working in this repository.

`CLAUDE.md` is a symlink to this file, so both paths refer to the same instructions. Update `AGENTS.md` only; do not maintain a separate `CLAUDE.md`.

## Project Structure & Module Organization

- `src/`: React + Vite frontend (`src/app/` shell/routing, `src/features/` feature modules, `src/components/` shared UI, `src/lib/` utilities, `src/i18n/` localization, `src/test/` test setup/utils).
- `src-tauri/`: Tauri v2 Rust backend (`src-tauri/src/commands/` Tauri commands, `src-tauri/src/services/` backend services, `src-tauri/migrations/` SQLite migrations).
- `e2e-tests/`: WebdriverIO tests (`e2e-tests/test/specs/` specs, `e2e-tests/test/support/` helpers, `e2e-tests/wdio.conf.ts` config).
- `scripts/`: Node helpers (e2e setup, third-party notices). Build output lands in `dist/`; transient artifacts in `tmp/`.

## Build, Test, and Development Commands

- Install deps: `npm ci` (Node.js 24+ recommended; CI uses Node.js 24).
- Frontend dev server: `npm run dev`.
- Desktop app (frontend + backend): `npm run tauri:dev` (Rust 1.95+ and Tauri OS prerequisites required).
- Production builds: `npm run build` (typecheck + Vite) and `npm run tauri:build` (desktop bundles).
- Checks to run before PRs: `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run notice:check`.
- E2E: `npm run e2e:setup` then `npm run e2e` (Linux headless: `npm run e2e:xvfb`). By default e2e uses built frontend assets; set `MODUDOC_E2E_MODE=dev` to run against the Vite dev server.
- Perf e2e: `npm run e2e:perf` runs the dedicated Milkdown/UI diagnostics spec and writes JSON output under `tmp/modudoc-e2e/run-*/perf/` by default. Sampling is controlled by `MODUDOC_E2E_PERF_ITERATIONS` and `MODUDOC_E2E_PERF_WARMUP`.

## Coding Style & Naming Conventions

- Formatting/linting: Biome (`npm run check` / `npm run check:fix`); do not hand-format.
- Defaults: spaces, 100-col lines, double quotes, semicolons.
- Tests: name as `*.test.ts` / `*.test.tsx` under `src/`. Prefer `@/…` imports (alias to `src/`).

## Testing Guidelines

- Unit/integration tests use Vitest + Testing Library; keep tests deterministic (avoid timing-based flake).
- i18n: update `src/i18n/locales/en.json` first and keep `zh.json` key sets identical (enforced by tests).

## Commit & Pull Request Guidelines

- Prefer Conventional Commits (common patterns in this repo): `feat(scope): …`, `fix(scope): …`, `test(e2e): …`, `style(…): …`, `build(…): …`.
- PRs: include a clear “what/why”, link related issues, and add screenshots/video for UI changes.
- If dependencies change, regenerate notices with `npm run notice:write` and ensure `npm run notice:check` passes.

## Agent-Specific Instructions (for Codex/automation)

- For long-running terminal tasks: start with `exec_command` to obtain a `session_id`, then use `write_stdin` (empty input) for status checks; default polling interval is ~5 minutes unless the task is expected to finish sooner or a quiet window is requested.
