/**
 * Phase 1 sync scheduler (document-first).
 *
 * The old project-level auto-sync is no longer the default flow. In document
 * mode, writes are driven manually by `DocumentTargetBar`. This module still
 * exports the legacy `scheduleProjectSync` and `forceProjectSync` symbols
 * so that the in-flight consumers (Sidebar, FragmentEditor, CommandPalette,
 * AssemblyBoard) keep their import sites valid. The functions now act as
 * no-ops; the actual write path is `writeDocumentToFile` in
 * `@/lib/api/documents`.
 */
import { debugLog } from "./debug";

export const DEFAULT_SYNC_DEBOUNCE_MS = 1800;

type LegacySyncRuntime = {
  timer: number | null;
  lastScheduledAt: number;
};

const runtimes = new Map<string, LegacySyncRuntime>();

function getRuntime(key: string): LegacySyncRuntime {
  const existing = runtimes.get(key);
  if (existing) return existing;
  const created: LegacySyncRuntime = { timer: null, lastScheduledAt: 0 };
  runtimes.set(key, created);
  return created;
}

function clearRuntime(runtime: LegacySyncRuntime) {
  if (runtime.timer) {
    window.clearTimeout(runtime.timer);
    runtime.timer = null;
  }
}

/**
 * Legacy: schedule a debounced project-level write. Phase 1 no longer
 * auto-syncs projects; this is a no-op that logs and returns.
 */
export function scheduleProjectSync(_args: {
  projectId: string;
  debounceMs?: number;
  setProjectStatusMessage?: (message: string | null) => void;
  setCompileStatus?: (status: string) => void;
}) {
  const runtime = getRuntime(_args.projectId);
  clearRuntime(runtime);
  debugLog("sync:schedule:noop", { projectId: _args.projectId });
}

/**
 * Legacy: force a project-level write. Phase 1 no longer auto-syncs
 * projects; this is a no-op that logs and returns.
 */
export async function forceProjectSync(_args: {
  projectId: string;
  policy?: string;
  setProjectStatusMessage?: (message: string | null) => void;
  setCompileStatus?: (status: string) => void;
}) {
  const runtime = getRuntime(_args.projectId);
  clearRuntime(runtime);
  debugLog("sync:force:noop", { projectId: _args.projectId });
}
