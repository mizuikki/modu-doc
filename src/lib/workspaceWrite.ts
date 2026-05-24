import type { CompileStatus } from "@/store/types";
import { writeTargetFile as apiWriteTargetFile } from "./api/sync";
import { normalizeAppError } from "./appError";

export const SAFE_SYNC_POLICY = "safe_sync";

export function applyWorkspaceWriteError(
  setWorkspaceStatusMessage: (message: string) => void,
  setCompileStatus: (status: CompileStatus) => void,
  error: unknown,
) {
  const message = normalizeAppError(error);
  setWorkspaceStatusMessage(message);
  setCompileStatus(message === "external_conflict" ? "conflicted" : "error");
  return message;
}

export async function writeTargetFile(workspaceId: string, conflictPolicy: string) {
  await apiWriteTargetFile({
    workspaceId,
    conflictPolicy: conflictPolicy as Parameters<typeof apiWriteTargetFile>[0]["conflictPolicy"],
  });
}
