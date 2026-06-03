import { invoke } from "@tauri-apps/api/core";
import { isE2ePerfEnabled, markE2ePerf } from "@/lib/e2ePerf";

type DebugPerfPayload = Record<string, unknown> | string | number | boolean | null | undefined;

function isEnabled() {
  return import.meta.env.DEV || isE2ePerfEnabled();
}

function normalizePayload(payload: DebugPerfPayload) {
  if (payload === undefined) {
    return null;
  }
  if (
    payload === null ||
    typeof payload === "string" ||
    typeof payload === "number" ||
    typeof payload === "boolean"
  ) {
    return String(payload);
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return "[unserializable]";
  }
}

export async function logDebugPerf(label: string, payload?: DebugPerfPayload) {
  if (!isEnabled()) {
    return;
  }

  markE2ePerf(label, normalizePayload(payload));

  if (!import.meta.env.DEV) {
    return;
  }

  try {
    await invoke("debug_log_frontend", {
      label,
      atMs: globalThis.performance?.now() ?? 0,
      payload: normalizePayload(payload),
    });
  } catch {
    // Ignore in browser-only contexts where the Tauri bridge is unavailable.
  }
}
