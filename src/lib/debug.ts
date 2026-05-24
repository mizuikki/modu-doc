const DEBUG_FLAG_KEY = "modudoc.debug";

export function isDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function debugLog(event: string, data?: Record<string, unknown>) {
  if (!isDebugEnabled()) return;
  if (data) {
    // eslint-disable-next-line no-console
    console.debug(`[modudoc] ${event}`, data);
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(`[modudoc] ${event}`);
}
