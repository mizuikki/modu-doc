# Release & Updater Checklist

This repo uses Tauri v2 and a tag-based release workflow.

## Tag-based release

- Create a tag like `modu-doc-v0.2.0` and push it.
- GitHub Actions workflow `.github/workflows/release.yml` builds installers for each platform and drafts a GitHub Release for the tag.

## Updater artifacts

- Release builds use `src-tauri/tauri.release.conf.json` to enable `bundle.createUpdaterArtifacts`.
- The release workflow uploads updater artifacts to the GitHub Release and publishes `update.json` to GitHub Pages (derived from `latest.json`).

## Manual verification (recommended before first public release)

1. Run a release build locally:
   - `npm run tauri:build:release`
2. Confirm updater artifacts exist under `src-tauri/target/release/bundle/` (exact structure varies per OS).
3. Install the release build and verify an update succeeds using the published `update.json` endpoint configured in `src-tauri/tauri.conf.json`.

## Troubleshooting (debug logs)

- Frontend debug logs:
  - DevTools console: `localStorage.setItem("modudoc.debug", "1")` then reload
- Backend debug logs:
  - macOS/Linux: `MODUDOC_DEBUG=1 npm run tauri:dev`
  - Windows (PowerShell): `$env:MODUDOC_DEBUG="1"; npm run tauri:dev`
