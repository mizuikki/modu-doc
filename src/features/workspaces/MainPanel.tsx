// Re-export of the new document-first center panel.
// `App.tsx` now renders `DocumentEditor` directly, but the legacy `MainPanel`
// import path is preserved for any callers (tests, storybook, etc.) that still
// reference it. The center panel is now document-only — recipe/fragment lookups
// by id, the `activeMainTab` segmented control, and the workspace-level status
// are all gone.
export { DocumentEditor as MainPanel } from "@/features/documents/DocumentEditor";
