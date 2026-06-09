/**
 * Phase 1 sync scheduler (document-first).
 *
 * The old workspace-level auto-sync is no longer the default flow. In document
 * mode, writes are driven manually by `DocumentTargetBar`. This module still
 * exports the legacy `scheduleWorkspaceSync` and `forceWorkspaceSync` symbols
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
 * Legacy: schedule a debounced workspace-level write. Phase 1 no longer
 * auto-syncs workspaces; this is a no-op that logs and returns.
 */
export function scheduleWorkspaceSync(_args: {
  workspaceId: string;
  debounceMs?: number;
  setWorkspaceStatusMessage?: (message: string | null) => void;
  setCompileStatus?: (status: string) => void;
}) {
  const runtime = getRuntime(_args.workspaceId);
  clearRuntime(runtime);
  debugLog("sync:schedule:noop", { workspaceId: _args.workspaceId });
}

/**
 * Legacy: force a workspace-level write. Phase 1 no longer auto-syncs
 * workspaces; this is a no-op that logs and returns.
 */
export async function forceWorkspaceSync(_args: {
  workspaceId: string;
  policy?: string;
  setWorkspaceStatusMessage?: (message: string | null) => void;
  setCompileStatus?: (status: string) => void;
}) {
  const runtime = getRuntime(_args.workspaceId);
  clearRuntime(runtime);
  debugLog("sync:force:noop", { workspaceId: _args.workspaceId });
}
