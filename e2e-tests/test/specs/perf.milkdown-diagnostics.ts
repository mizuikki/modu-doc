// Header note: this spec was originally titled "Milkdown performance
// diagnostics" because the main document editor used to be a Milkdown
// ProseMirror surface. The document-first refactor replaced that editor
// with a plain `<textarea data-testid="editor-pane-textarea">`, so the
// scenarios now measure type latency on that textarea. The spec keeps its
// filename (`perf.milkdown-diagnostics.ts`) because it is referenced by
// `pnpm run e2e:perf`; only the measurement target changed.
//
// The markdown seed / warmup scaffolding (buildMarkdownDocument, the
// PerfAnalysis project with small/medium/large fragments) is preserved
// so the surrounding workflow and the perf fixtures remain identical
// across the editor migration.

import { browser } from "@wdio/globals";
import { blurActiveElement, typeInDocumentEditor } from "../support/editor";
import {
  durationBetween,
  eventPayloadRecord,
  findFirstEvent,
  findLastEvent,
  markPerf,
  measureScenario,
  type PerfEvent,
  readAppVersion,
  snapshotPerfEvents,
  waitForPerfEvent,
  writePerfReport,
} from "../support/perf";
import {
  createAndOpenProject,
  loadProject,
  openProjectSwitcher,
  type ProjectLoadResult,
  selectProjectById,
} from "../support/project";
import { tauriInvoke, waitForTauriBridge } from "../support/tauri";
import { safeClick, safeSetValue } from "../support/ui";

type ProjectSummary = Pick<ProjectLoadResult["project"], "id" | "name">;
type DocumentSummary = ProjectLoadResult["documents"][number];

type PerfProjectContext = {
  startupProject: ProjectSummary;
  workflowProjectId: string;
  analysisProject: ProjectSummary;
  documents: {
    smallA: DocumentSummary;
    smallB: DocumentSummary;
    mediumA: DocumentSummary;
    mediumB: DocumentSummary;
    largeA: DocumentSummary;
    autosave: DocumentSummary;
  };
};

function parsePositiveEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

function repeatParagraph(seed: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${seed} paragraph ${index + 1}.`).join(
    "\n\n",
  );
}

function buildMarkdownDocument(title: string, targetBytes: number) {
  const sections = [
    `# ${title}`,
    `> Perf seed for ${title}`,
    "- item one\n- item two\n- item three",
    "[example link](https://example.com)",
    "```md\ncode block line 1\ncode block line 2\n```",
  ];
  let text = sections.join("\n\n");
  let counter = 0;
  while (text.length < targetBytes) {
    counter += 1;
    text += `\n\n## Section ${counter}\n\n${repeatParagraph(`${title} repeated`, 3)}`;
  }
  return text.slice(0, targetBytes);
}

function hasDocumentId(event: PerfEvent, documentId: string) {
  return eventPayloadRecord(event)?.documentId === documentId;
}

async function waitForPerfCollectorReady(timeoutMs = 20000) {
  await browser.waitUntil(
    async () => {
      try {
        return (await browser.execute(() => Boolean(window.__MODUDOC_E2E_PERF__))) as boolean;
      } catch {
        return false;
      }
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: "e2e perf collector unavailable" },
  );
}

async function waitForEditorTextareaReady(timeoutMs = 20000) {
  const textarea = await $("[data-testid='editor-pane-textarea']");
  await browser.waitUntil(async () => await textarea.isExisting(), {
    timeout: timeoutMs,
    interval: 100,
    timeoutMsg: "editor-pane-textarea not ready",
  });
}

async function waitForEditorDocument(documentId: string, timeoutMs = 20000) {
  const editMode = await $("[data-testid='document-header-mode-edit']");
  if ((await editMode.isExisting()) && (await editMode.getAttribute("data-active")) !== "true") {
    await safeClick("[data-testid='document-header-mode-edit']", timeoutMs);
  }
  await waitForEditorTextareaReady(timeoutMs);
  await browser.waitUntil(
    async () => {
      const textarea = await $("[data-testid='editor-pane-textarea']");
      return (await textarea.getAttribute("data-document-id")) === documentId;
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: `editor not bound: ${documentId}` },
  );
  await browser
    .waitUntil(
      async () => {
        const events = await snapshotPerfEvents();
        return Boolean(
          findLastEvent(events, "document editor: document bound", (event) =>
            hasDocumentId(event, documentId),
          ),
        );
      },
      { timeout: Math.min(timeoutMs, 1000), interval: 100 },
    )
    .catch(() => undefined);
}

async function createAnalysisProjectContext(): Promise<PerfProjectContext> {
  // 1. Startup project: used purely to capture the cold-start-to-first-
  //    editor-ready timing. The session is not reloaded; the perf markers
  //    we read cover the initial bootstrap path.
  const startupOpen = await createAndOpenProject(uniqueName("Perf Startup"));
  const startupProject = { id: startupOpen.projectId, name: startupOpen.name };

  // 2. Workflow project: a small clean project used to measure the
  //    create-project / create-document flow.
  const workflowOpen = await createAndOpenProject(uniqueName("Perf Workflow"));
  const workflowProject = { id: workflowOpen.projectId, name: workflowOpen.name };

  // 3. Analysis project: hosts the typed document fixtures (small /
  //    medium / large / autosave).
  const analysisOpen = await createAndOpenProject(uniqueName("Perf Analysis"));
  const analysisProject = { id: analysisOpen.projectId, name: analysisOpen.name };

  const documentSpecs = [
    { key: "smallA", name: "Perf Small A", bytes: 2048 },
    { key: "smallB", name: "Perf Small B", bytes: 3072 },
    { key: "mediumA", name: "Perf Medium A", bytes: 16384 },
    { key: "mediumB", name: "Perf Medium B", bytes: 32768 },
    { key: "largeA", name: "Perf Large A", bytes: 131072 },
    { key: "autosave", name: "Perf Autosave", bytes: 4096 },
  ] as const;

  for (const spec of documentSpecs) {
    const created = await tauriInvoke<{ id: string }>("create_document", {
      request: {
        projectId: analysisProject.id,
        name: spec.name,
        content: buildMarkdownDocument(spec.name, spec.bytes),
      },
    });
    if (!created.id) {
      throw new Error(`create_document returned no id for ${spec.name}`);
    }
    void created;
  }

  await browser.waitUntil(
    async () => {
      const bundle = await loadProject(analysisProject.id);
      return bundle.documents.length >= documentSpecs.length;
    },
    { timeout: 30000, interval: 200 },
  );

  await tauriInvoke("create_snapshot", {
    documentId: (await loadProject(analysisProject.id)).documents.find(
      (entry) => entry.name === "Perf Small A",
    )?.id,
    label: "perf-baseline",
  });

  const bundle = await loadProject(analysisProject.id);
  const documentByName = new Map(bundle.documents.map((doc) => [doc.name, doc]));
  const documents = {
    smallA: documentByName.get("Perf Small A"),
    smallB: documentByName.get("Perf Small B"),
    mediumA: documentByName.get("Perf Medium A"),
    mediumB: documentByName.get("Perf Medium B"),
    largeA: documentByName.get("Perf Large A"),
    autosave: documentByName.get("Perf Autosave"),
  };
  if (Object.values(documents).some((doc) => !doc)) {
    throw new Error("analysis documents missing");
  }

  await selectProjectById(analysisProject.id);
  await selectDocumentInSidebar(documents.smallA?.id ?? "");
  await waitForEditorTextareaReady();

  return {
    startupProject,
    workflowProjectId: workflowProject.id,
    analysisProject,
    documents: documents as PerfProjectContext["documents"],
  };
}

async function selectDocumentInSidebar(documentId: string, timeoutMs = 20000) {
  await safeClick(`[data-testid='sidebar-document-${documentId}']`, timeoutMs);
  await browser.waitUntil(
    async () => {
      const trigger = await $(`[data-testid='sidebar-document-${documentId}']`);
      return (await trigger.getAttribute("data-active")) === "true";
    },
    { timeout: timeoutMs, interval: 200 },
  );
}

function summarizeSwitchSample(events: PerfEvent[], documentId: string) {
  const start = findLastEvent(events, "wdio:scenario-start");
  const bound = findLastEvent(events, "document editor: document bound", (event) =>
    hasDocumentId(event, documentId),
  );
  return {
    totalMs: durationBetween(start, bound),
    markerBreakdown: {
      documentBoundMs: bound ? durationBetween(start, bound) : 0,
    },
  };
}

describe("Document editor performance diagnostics", () => {
  it("captures the main workflow and editor scenarios", async () => {
    // Note: the global wdio mocha timeout (see e2e-tests/wdio.conf.ts) is
    // bumped above the default 120s so this spec has room for warmup +
    // iterations of every scenario.
    const iterations = parsePositiveEnv("MODUDOC_E2E_PERF_ITERATIONS", 5);
    const warmupIterations = parsePositiveEnv("MODUDOC_E2E_PERF_WARMUP", 1);

    await waitForTauriBridge();
    await waitForPerfCollectorReady();

    const context = await createAnalysisProjectContext();
    const startupEvents = await snapshotPerfEvents();
    const appVersion = await readAppVersion();

    const startupStart =
      findFirstEvent(startupEvents, "main module evaluated") ??
      findFirstEvent(startupEvents, "react root render scheduled");
    const startupReady =
      findFirstEvent(startupEvents, "document editor: editor ready") ??
      findFirstEvent(startupEvents, "document editor: document bound");
    if (!startupStart || !startupReady) {
      throw new Error("missing startup performance markers");
    }

    const reports = [
      {
        name: "cold_start_to_first_editor_ready",
        kind: "startup" as const,
        samples: [
          {
            totalMs: durationBetween(startupStart, startupReady),
            markerBreakdown: {
              projectListMs: durationBetween(
                startupStart,
                findFirstEvent(startupEvents, "project bootstrap: list done") ?? startupReady,
              ),
              initialBundleMs: durationBetween(
                startupStart,
                findFirstEvent(startupEvents, "project bootstrap: initial bundle done") ??
                  startupReady,
              ),
              editorReadyMs: durationBetween(startupStart, startupReady),
            },
            eventCount: startupEvents.length,
          },
        ],
        summary: {
          min: durationBetween(startupStart, startupReady),
          median: durationBetween(startupStart, startupReady),
          p95: durationBetween(startupStart, startupReady),
          max: durationBetween(startupStart, startupReady),
          mean: durationBetween(startupStart, startupReady),
        },
      },
      await measureScenario({
        name: "create_project_via_ui",
        kind: "workflow",
        iterations,
        warmupIterations,
        action: async (iteration) => {
          const projectName = uniqueName(`Perf Created Project ${iteration}`);
          await markPerf("wdio:project-name", { projectName });
          await openProjectSwitcher();
          await safeClick("[data-testid='sidebar-new-project']");
          await safeSetValue("[data-testid='app-prompt-input']", projectName);
          await safeClick("[data-testid='app-dialog-confirm']");
        },
        settle: async () => {
          const events = await snapshotPerfEvents();
          const projectName = eventPayloadRecord(
            findLastEvent(events, "wdio:project-name"),
          )?.projectName;
          if (typeof projectName !== "string") {
            throw new Error("missing project name");
          }
          await browser.waitUntil(
            async () => {
              const projects = await tauriInvoke<ProjectSummary[]>("list_projects");
              return projects.some((entry) => entry.name === projectName);
            },
            { timeout: 30000, interval: 200 },
          );
        },
      }),
      await measureScenario({
        name: "create_document_via_ui",
        kind: "workflow",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.workflowProjectId);
        },
        action: async (iteration) => {
          const documentName = uniqueName(`Perf Document ${iteration}`);
          await markPerf("wdio:document-name", { documentName });
          await safeClick("[data-testid='document-list-new']");
          await safeSetValue("[data-testid='app-prompt-input']", documentName);
          await safeClick("[data-testid='app-dialog-confirm']");
        },
        settle: async () => {
          const events = await snapshotPerfEvents();
          const documentName = eventPayloadRecord(
            findLastEvent(events, "wdio:document-name"),
          )?.documentName;
          if (typeof documentName !== "string") {
            throw new Error("missing document name");
          }
          await browser.waitUntil(
            async () => {
              const bundle = await loadProject(context.workflowProjectId);
              return bundle.documents.some((entry) => entry.name === documentName);
            },
            { timeout: 30000, interval: 200 },
          );
        },
      }),
      await measureScenario({
        name: "switch_current_document_small_to_small",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.smallA.id);
          await waitForEditorDocument(context.documents.smallA.id);
        },
        action: async () => {
          await selectDocumentInSidebar(context.documents.smallB.id);
        },
        settle: async () => {
          await waitForEditorDocument(context.documents.smallB.id);
        },
        analyze: (events) => summarizeSwitchSample(events, context.documents.smallB.id),
      }),
      await measureScenario({
        name: "switch_current_document_small_to_large",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.smallA.id);
          await waitForEditorDocument(context.documents.smallA.id);
        },
        action: async () => {
          await selectDocumentInSidebar(context.documents.largeA.id);
        },
        settle: async () => {
          await waitForEditorDocument(context.documents.largeA.id, 30000);
        },
        analyze: (events) => summarizeSwitchSample(events, context.documents.largeA.id),
      }),
      await measureScenario({
        name: "switch_current_document_large_to_small",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.largeA.id);
          await waitForEditorDocument(context.documents.largeA.id);
        },
        action: async () => {
          await selectDocumentInSidebar(context.documents.smallA.id);
        },
        settle: async () => {
          await waitForEditorDocument(context.documents.smallA.id);
        },
        analyze: (events) => summarizeSwitchSample(events, context.documents.smallA.id),
      }),
      await measureScenario({
        name: "first_input_small_doc",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.smallA.id);
          await waitForEditorDocument(context.documents.smallA.id);
        },
        action: async (iteration) => {
          await typeInDocumentEditor(`s${iteration}`);
        },
        settle: async () => {
          await waitForPerfEvent(
            "document editor: content updated",
            (event) => hasDocumentId(event, context.documents.smallA.id),
            20000,
          );
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const updated = findLastEvent(events, "document editor: content updated", (event) =>
            hasDocumentId(event, context.documents.smallA.id),
          );
          return {
            totalMs: durationBetween(start, updated),
            markerBreakdown: {
              inputToContentUpdatedMs: durationBetween(start, updated),
            },
          };
        },
      }),
      await measureScenario({
        name: "first_input_large_doc",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.largeA.id);
          await waitForEditorDocument(context.documents.largeA.id);
        },
        action: async (iteration) => {
          await typeInDocumentEditor(`l${iteration}`);
        },
        settle: async () => {
          await waitForPerfEvent(
            "document editor: content updated",
            (event) => hasDocumentId(event, context.documents.largeA.id),
            30000,
          );
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const updated = findLastEvent(events, "document editor: content updated", (event) =>
            hasDocumentId(event, context.documents.largeA.id),
          );
          return {
            totalMs: durationBetween(start, updated),
            markerBreakdown: {
              inputToContentUpdatedMs: durationBetween(start, updated),
            },
          };
        },
      }),
      await measureScenario({
        name: "blur_to_autosave_persisted",
        kind: "autosave",
        iterations,
        warmupIterations,
        prepare: async (iteration) => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.autosave.id);
          await waitForEditorDocument(context.documents.autosave.id);
          const bundle = await loadProject(context.analysisProject.id);
          const doc = bundle.documents.find((entry) => entry.id === context.documents.autosave.id);
          if (!doc) {
            throw new Error("autosave document missing");
          }
          const suffix = ` autosave-${iteration}`;
          await typeInDocumentEditor(suffix);
          await markPerf("wdio:autosave-expected", {
            content: `${doc.content}${suffix}`,
          });
        },
        action: async () => {
          await blurActiveElement();
        },
        settle: async () => {
          const events = await snapshotPerfEvents();
          const expected = eventPayloadRecord(
            findLastEvent(events, "wdio:autosave-expected"),
          )?.content;
          if (typeof expected !== "string") {
            throw new Error("missing autosave expected content");
          }
          const suffixMatch = expected.match(/autosave-\d+$/);
          if (!suffixMatch) {
            return;
          }
          const suffix = suffixMatch[0];
          await browser.waitUntil(
            async () => {
              const bundle = await loadProject(context.analysisProject.id);
              const doc = bundle.documents.find(
                (entry) => entry.id === context.documents.autosave.id,
              );
              return doc?.content?.includes(suffix) ?? false;
            },
            { timeout: 30000, interval: 200 },
          );
        },
      }),
      await measureScenario({
        name: "switch_to_preview_mode",
        kind: "navigation",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.smallA.id);
          await waitForEditorDocument(context.documents.smallA.id);
        },
        action: async () => {
          await safeClick("[data-testid='document-header-mode-preview']");
        },
        settle: async () => {
          await browser.waitUntil(
            async () =>
              (await $("[data-testid='document-header-mode-preview']").getAttribute(
                "data-active",
              )) === "true",
            { timeout: 20000, interval: 200 },
          );
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const ready = findLastEvent(events, "document header: mode ready:preview");
          return {
            totalMs: ready ? durationBetween(start, ready) : 0,
            markerBreakdown: {
              previewReadyMs: ready ? durationBetween(start, ready) : 0,
            },
          };
        },
      }),
      await measureScenario({
        name: "switch_to_history_mode",
        kind: "navigation",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectProjectById(context.analysisProject.id);
          await selectDocumentInSidebar(context.documents.smallA.id);
          await waitForEditorDocument(context.documents.smallA.id);
        },
        action: async () => {
          await safeClick("[data-testid='document-header-mode-history']");
        },
        settle: async () => {
          await browser.waitUntil(
            async () => await $("[data-testid='history-diff']").isExisting(),
            { timeout: 20000, interval: 200 },
          );
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const ready = findLastEvent(events, "document header: mode ready:history");
          return {
            totalMs: ready ? durationBetween(start, ready) : 0,
            markerBreakdown: {
              historyReadyMs: ready ? durationBetween(start, ready) : 0,
            },
          };
        },
      }),
    ];

    const report = {
      appVersion,
      platform: process.platform,
      mode: process.env.MODUDOC_E2E_MODE ?? "dist",
      timestamp: new Date().toISOString(),
      iterations,
      warmupIterations,
      startupProjectId: context.startupProject.id,
      workflowProjectId: context.workflowProjectId,
      analysisProjectId: context.analysisProject.id,
      scenarios: reports,
    };

    const reportPath = await writePerfReport("milkdown-diagnostics.json", report);
    console.table(
      reports.map((scenario) => ({
        scenario: scenario.name,
        kind: scenario.kind,
        samples: scenario.samples.length,
        minMs: scenario.summary.min,
        medianMs: scenario.summary.median,
        p95Ms: scenario.summary.p95,
        maxMs: scenario.summary.max,
      })),
    );
    // eslint-disable-next-line no-console
    console.log(`[MODUDOC_E2E_PERF] wrote ${reportPath}`);
  });
});
