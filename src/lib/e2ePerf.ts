type E2ePerfPayload = Record<string, unknown> | string | number | boolean | null;

export type E2ePerfEvent = {
  name: string;
  atMs: number;
  payload: E2ePerfPayload;
};

export type E2ePerfCollector = {
  mark: (name: string, payload?: E2ePerfPayload) => void;
  clear: () => void;
  snapshot: () => E2ePerfEvent[];
};

declare global {
  interface Window {
    __MODUDOC_E2E_PERF__?: E2ePerfCollector;
  }
}

const MAX_EVENTS = 400;

function isBrowser() {
  return typeof window !== "undefined";
}

export function isE2ePerfEnabled() {
  return isBrowser();
}

function normalizePayload(payload: E2ePerfPayload | undefined): E2ePerfPayload {
  if (payload === undefined) {
    return null;
  }
  if (
    payload === null ||
    typeof payload === "string" ||
    typeof payload === "number" ||
    typeof payload === "boolean"
  ) {
    return payload;
  }
  try {
    return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  } catch {
    return "[unserializable]";
  }
}

export function ensureE2ePerfCollector() {
  if (!isE2ePerfEnabled() || !isBrowser()) {
    return null;
  }
  const existing = window.__MODUDOC_E2E_PERF__;
  if (existing) {
    return existing;
  }

  const events: E2ePerfEvent[] = [];
  const collector: E2ePerfCollector = {
    mark(name, payload) {
      events.push({
        name,
        atMs: globalThis.performance?.now() ?? 0,
        payload: normalizePayload(payload),
      });
      if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
      }
    },
    clear() {
      events.length = 0;
    },
    snapshot() {
      return events.slice();
    },
  };
  window.__MODUDOC_E2E_PERF__ = collector;
  return collector;
}

export function markE2ePerf(name: string, payload?: E2ePerfPayload) {
  ensureE2ePerfCollector()?.mark(name, payload);
}
