import { invoke } from "@tauri-apps/api/core";
import { logDebugPerf } from "@/lib/debugPerf";
import { normalizeApiErrorCode } from "./errors";

export async function tauriInvoke<TResult>(
  command: string,
  args?: Record<string, unknown>,
): Promise<TResult> {
  const startedAt = globalThis.performance?.now() ?? 0;
  if (import.meta.env.DEV && (command === "list_projects" || command === "load_project")) {
    void logDebugPerf(`tauri invoke start:${command}`, args ?? null);
  }
  try {
    const result = (await invoke(command, args ?? {})) as TResult;
    if (import.meta.env.DEV && (command === "list_projects" || command === "load_project")) {
      void logDebugPerf(`tauri invoke done:${command}`, {
        durationMs: (globalThis.performance?.now() ?? startedAt) - startedAt,
      });
    }
    return result;
  } catch (error) {
    if (import.meta.env.DEV && (command === "list_projects" || command === "load_project")) {
      void logDebugPerf(`tauri invoke failed:${command}`, {
        durationMs: (globalThis.performance?.now() ?? startedAt) - startedAt,
      });
    }
    throw new Error(normalizeApiErrorCode(error));
  }
}
