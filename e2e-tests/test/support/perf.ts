import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser } from "@wdio/globals";

export type PerfEvent = {
  name: string;
  atMs: number;
  payload: Record<string, unknown> | string | number | boolean | null;
};

export type ScenarioSample = {
  totalMs: number;
  markerBreakdown?: Record<string, number>;
  eventCount: number;
};

export type ScenarioReport = {
  name: string;
  kind: "startup" | "workflow" | "editor" | "navigation" | "autosave";
  samples: ScenarioSample[];
  summary: ScenarioSummary;
};

export type ScenarioSummary = {
  min: number;
  median: number;
  p95: number;
  max: number;
  mean: number;
};

type MeasureScenarioOptions = {
  name: string;
  kind: ScenarioReport["kind"];
  iterations: number;
  warmupIterations: number;
  prepare?: (iteration: number) => Promise<void>;
  action: (iteration: number) => Promise<void>;
  settle: (iteration: number) => Promise<void>;
  analyze?: (events: PerfEvent[]) => Omit<ScenarioSample, "eventCount">;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index] ?? 0;
}

export function summarizeSamples(samples: ScenarioSample[]): ScenarioSummary {
  const values = samples.map((sample) => sample.totalMs).sort((a, b) => a - b);
  const mean =
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    min: round2(values[0] ?? 0),
    median: round2(percentile(values, 0.5)),
    p95: round2(percentile(values, 0.95)),
    max: round2(values.at(-1) ?? 0),
    mean: round2(mean),
  };
}

export async function clearPerfEvents() {
  await browser.execute(() => {
    window.__MODUDOC_E2E_PERF__?.clear();
  });
}

export async function markPerf(name: string, payload?: Record<string, unknown>) {
  await browser.execute(
    (eventName, eventPayload) => {
      window.__MODUDOC_E2E_PERF__?.mark(eventName, eventPayload);
    },
    name,
    payload ?? null,
  );
}

export async function snapshotPerfEvents() {
  return (await browser.execute(() => {
    return window.__MODUDOC_E2E_PERF__?.snapshot() ?? [];
  })) as PerfEvent[];
}

export function findFirstEvent(
  events: PerfEvent[],
  name: string,
  predicate?: (event: PerfEvent) => boolean,
) {
  return events.find((event) => event.name === name && (!predicate || predicate(event))) ?? null;
}

export function findLastEvent(
  events: PerfEvent[],
  name: string,
  predicate?: (event: PerfEvent) => boolean,
) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.name === name && (!predicate || predicate(event))) {
      return event;
    }
  }
  return null;
}

export function eventPayloadRecord(event: PerfEvent | null) {
  return event?.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : null;
}

export function durationBetween(start: PerfEvent | null, end: PerfEvent | null) {
  if (!start || !end) {
    throw new Error("missing performance markers");
  }
  return round2(end.atMs - start.atMs);
}

export async function waitForPerfEvent(
  name: string,
  predicate?: (event: PerfEvent) => boolean,
  timeoutMs = 20000,
) {
  await browser.waitUntil(
    async () => {
      const events = await snapshotPerfEvents();
      return Boolean(findLastEvent(events, name, predicate));
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: `Missing perf event: ${name}` },
  );
}

export async function measureScenario(options: MeasureScenarioOptions): Promise<ScenarioReport> {
  const samples: ScenarioSample[] = [];
  const totalIterations = options.iterations + options.warmupIterations;

  for (let iteration = 0; iteration < totalIterations; iteration += 1) {
    await clearPerfEvents();
    await options.prepare?.(iteration);
    await markPerf("wdio:scenario-start", {
      scenario: options.name,
      iteration,
      warmup: iteration < options.warmupIterations,
    });
    await options.action(iteration);
    await options.settle(iteration);
    await markPerf("wdio:scenario-end", {
      scenario: options.name,
      iteration,
      warmup: iteration < options.warmupIterations,
    });

    const events = await snapshotPerfEvents();
    const analyzed = options.analyze?.(events);
    const start = findLastEvent(events, "wdio:scenario-start");
    const end = findLastEvent(events, "wdio:scenario-end");
    const sample: ScenarioSample = {
      totalMs: analyzed?.totalMs ?? durationBetween(start, end),
      markerBreakdown: analyzed?.markerBreakdown,
      eventCount: events.length,
    };
    if (iteration >= options.warmupIterations) {
      samples.push(sample);
    }
  }

  return {
    name: options.name,
    kind: options.kind,
    samples,
    summary: summarizeSamples(samples),
  };
}

export async function readAppVersion() {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

export async function writePerfReport(filename: string, report: Record<string, unknown>) {
  const outputDir =
    process.env.MODUDOC_E2E_PERF_OUTPUT ||
    path.join(
      process.env.MODUDOC_E2E_RUN_DIR || path.join(projectRoot, "tmp", "modudoc-e2e"),
      "perf",
    );
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, filename);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}
