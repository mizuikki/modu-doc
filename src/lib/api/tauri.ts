import { invoke } from "@tauri-apps/api/core";
import { normalizeApiErrorCode } from "./errors";

export async function tauriInvoke<TResult>(
  command: string,
  args?: Record<string, unknown>,
): Promise<TResult> {
  try {
    return (await invoke(command, args ?? {})) as TResult;
  } catch (error) {
    throw new Error(normalizeApiErrorCode(error));
  }
}
