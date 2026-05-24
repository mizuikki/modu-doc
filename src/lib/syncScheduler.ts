import { applyWorkspaceWriteError, SAFE_SYNC_POLICY, writeTargetFile } from "@/lib/workspaceWrite";
import type { CompileStatus } from "@/store/types";
import { debugLog } from "./debug";

type WorkspaceSyncRuntime = {
  timer: number | null;
  lastScheduledAt: number;
};

const runtimes = new Map<string, WorkspaceSyncRuntime>();

export const DEFAULT_SYNC_DEBOUNCE_MS = 1800;

function getRuntime(workspaceId: string): WorkspaceSyncRuntime {
  const existing = runtimes.get(workspaceId);
  if (existing) return existing;
  const created: WorkspaceSyncRuntime = { timer: null, lastScheduledAt: 0 };
  runtimes.set(workspaceId, created);
  return created;
}

export function scheduleWorkspaceSync(args: {
  workspaceId: string;
  debounceMs?: number;
  setWorkspaceStatusMessage: (message: string | null) => void;
  setCompileStatus: (status: CompileStatus) => void;
}) {
  const runtime = getRuntime(args.workspaceId);
  const debounceMs = Math.max(300, args.debounceMs ?? DEFAULT_SYNC_DEBOUNCE_MS);
  runtime.lastScheduledAt = Date.now();
  debugLog("sync:schedule", { workspaceId: args.workspaceId, debounceMs });

  if (runtime.timer) {
    window.clearTimeout(runtime.timer);
  }

  runtime.timer = window.setTimeout(() => {
    runtime.timer = null;
    debugLog("sync:debounced_fire", { workspaceId: args.workspaceId });
    void forceWorkspaceSync({
      workspaceId: args.workspaceId,
      setWorkspaceStatusMessage: args.setWorkspaceStatusMessage,
      setCompileStatus: args.setCompileStatus,
      policy: SAFE_SYNC_POLICY,
    });
  }, debounceMs);
}

export async function forceWorkspaceSync(args: {
  workspaceId: string;
  policy: string;
  setWorkspaceStatusMessage: (message: string | null) => void;
  setCompileStatus: (status: CompileStatus) => void;
}) {
  const runtime = getRuntime(args.workspaceId);
  if (runtime.timer) {
    window.clearTimeout(runtime.timer);
    runtime.timer = null;
  }
  debugLog("sync:force", { workspaceId: args.workspaceId, policy: args.policy });
  try {
    await writeTargetFile(args.workspaceId, args.policy);
    debugLog("sync:ok", { workspaceId: args.workspaceId });
  } catch (error) {
    debugLog("sync:error", {
      workspaceId: args.workspaceId,
      policy: args.policy,
      error: error instanceof Error ? error.message : String(error),
    });
    applyWorkspaceWriteError(args.setWorkspaceStatusMessage, args.setCompileStatus, error);
    throw error;
  }
}
