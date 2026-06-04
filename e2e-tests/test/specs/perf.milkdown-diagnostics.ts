import { browser } from "@wdio/globals";
import {
  blurActiveElement,
  focusFragmentEditor,
  typeInFragmentEditor,
  waitForFragmentEditorReady,
} from "../support/editor";
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
import { tauriInvoke, waitForTauriBridge } from "../support/tauri";
import { safeClick, safeSetValue, selectWorkspaceById } from "../support/ui";
import {
  createAndSelectWorkspace,
  loadWorkspace,
  type WorkspaceLoadResult,
} from "../support/workspace";

type WorkspaceSummary = WorkspaceLoadResult["workspace"];
type FragmentSummary = WorkspaceLoadResult["fragments"][number];

type PerfWorkspaceContext = {
  startupWorkspace: WorkspaceSummary;
  workflowWorkspaceId: string;
  analysisWorkspace: WorkspaceSummary;
  fragments: {
    smallA: FragmentSummary;
    smallB: FragmentSummary;
    mediumA: FragmentSummary;
    mediumB: FragmentSummary;
    largeA: FragmentSummary;
    autosave: FragmentSummary;
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

async function waitForFragmentLabel(fragmentName: string, timeoutMs = 20000) {
  await browser.waitUntil(
    async () => {
      const label = await $("label[for='fragment-editor']");
      if (!(await label.isExisting())) {
        return false;
      }
      return (await label.getText()).includes(fragmentName);
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: `fragment label not ready: ${fragmentName}` },
  );
}

async function waitForEditorDocument(documentId: string, fragmentName: string, timeoutMs = 20000) {
  await waitForFragmentEditorReady(timeoutMs);
  await waitForFragmentLabel(fragmentName, timeoutMs);
  await browser.waitUntil(
    async () => {
      const events = await snapshotPerfEvents();
      return Boolean(
        findLastEvent(events, "milkdown: replace done", (event) =>
          hasDocumentId(event, documentId),
        ) ||
          findLastEvent(events, "fragment editor: document bound", (event) =>
            hasDocumentId(event, documentId),
          ) ||
          findLastEvent(events, "milkdown: editor ready", (event) =>
            hasDocumentId(event, documentId),
          ),
      );
    },
    { timeout: timeoutMs, interval: 100, timeoutMsg: `editor not bound: ${fragmentName}` },
  );
}

async function currentWorkspaceId() {
  const trigger = await $("[data-testid='workspace-select-trigger']");
  return (await trigger.getAttribute("data-current-workspace-id")) ?? "";
}

async function listWorkspaces() {
  return await tauriInvoke<WorkspaceSummary[]>("list_workspaces");
}

async function prepareStartupWorkspaceAndReload() {
  const workspace = await createAndSelectWorkspace({
    name: uniqueName("Perf Startup"),
    targetPath: null,
  });
  await tauriInvoke("create_fragment", {
    workspaceId: workspace.id,
    name: "Startup fragment",
    content: buildMarkdownDocument("Startup fragment", 2048),
    attachToRecipe: true,
  });
  const bundle = await loadWorkspace(workspace.id);
  const fragment = bundle.fragments.find((entry) => entry.name === "Startup fragment");
  if (!fragment) {
    throw new Error("startup fragment missing");
  }
  await safeClick(`[data-testid='recipe-item-select-${fragment.id}']`);
  await browser.reloadSession();
  await waitForTauriBridge();
  await waitForPerfCollectorReady();
  await waitForFragmentEditorReady();
  return workspace;
}

async function createAnalysisWorkspaceContext(): Promise<PerfWorkspaceContext> {
  const startupWorkspace = await prepareStartupWorkspaceAndReload();
  const workflowWorkspace = await createAndSelectWorkspace({
    name: uniqueName("Perf Workflow"),
    targetPath: null,
  });
  await tauriInvoke("create_fragment", {
    workspaceId: workflowWorkspace.id,
    name: "Workflow baseline",
    content: "Workflow baseline",
    attachToRecipe: true,
  });
  const analysisWorkspace = await createAndSelectWorkspace({
    name: uniqueName("Perf Analysis"),
    targetPath: null,
  });

  const fragmentDocs = [
    { key: "smallA", name: "Perf Small A", bytes: 2048 },
    { key: "smallB", name: "Perf Small B", bytes: 3072 },
    { key: "mediumA", name: "Perf Medium A", bytes: 16384 },
    { key: "mediumB", name: "Perf Medium B", bytes: 32768 },
    { key: "largeA", name: "Perf Large A", bytes: 131072 },
    { key: "autosave", name: "Perf Autosave", bytes: 4096 },
  ] as const;

  for (const doc of fragmentDocs) {
    await tauriInvoke("create_fragment", {
      workspaceId: analysisWorkspace.id,
      name: doc.name,
      content: buildMarkdownDocument(doc.name, doc.bytes),
      attachToRecipe: true,
    });
  }

  await browser.waitUntil(
    async () => {
      const bundle = await loadWorkspace(analysisWorkspace.id);
      return bundle.fragments.length >= fragmentDocs.length;
    },
    { timeout: 30000, interval: 200 },
  );

  await tauriInvoke("create_snapshot", {
    workspaceId: analysisWorkspace.id,
    label: "perf-baseline",
  });

  const bundle = await loadWorkspace(analysisWorkspace.id);
  const fragmentByName = new Map(bundle.fragments.map((fragment) => [fragment.name, fragment]));
  const fragments = {
    smallA: fragmentByName.get("Perf Small A"),
    smallB: fragmentByName.get("Perf Small B"),
    mediumA: fragmentByName.get("Perf Medium A"),
    mediumB: fragmentByName.get("Perf Medium B"),
    largeA: fragmentByName.get("Perf Large A"),
    autosave: fragmentByName.get("Perf Autosave"),
  };
  if (Object.values(fragments).some((fragment) => !fragment)) {
    throw new Error("analysis fragments missing");
  }

  await selectWorkspaceById(analysisWorkspace.id);
  await safeClick(`[data-testid='recipe-item-select-${fragments.smallA?.id}']`);
  await waitForFragmentEditorReady();

  return {
    startupWorkspace,
    workflowWorkspaceId: workflowWorkspace.id,
    analysisWorkspace,
    fragments: fragments as PerfWorkspaceContext["fragments"],
  };
}

function summarizeSwitchSample(events: PerfEvent[], documentId: string) {
  const start = findLastEvent(events, "wdio:scenario-start");
  const bound = findLastEvent(events, "fragment editor: document bound", (event) =>
    hasDocumentId(event, documentId),
  );
  const replace = findLastEvent(events, "milkdown: replace done", (event) =>
    hasDocumentId(event, documentId),
  );
  return {
    totalMs: durationBetween(start, replace ?? bound),
    markerBreakdown: {
      documentBoundMs: bound ? durationBetween(start, bound) : 0,
      replaceMs: replace ? durationBetween(start, replace) : 0,
    },
  };
}

describe("Milkdown performance diagnostics", () => {
  it("captures the main workflow and editor scenarios", async () => {
    const iterations = parsePositiveEnv("MODUDOC_E2E_PERF_ITERATIONS", 5);
    const warmupIterations = parsePositiveEnv("MODUDOC_E2E_PERF_WARMUP", 1);

    await waitForTauriBridge();
    await waitForPerfCollectorReady();

    const context = await createAnalysisWorkspaceContext();
    const startupEvents = await snapshotPerfEvents();
    const appVersion = await readAppVersion();

    const startupStart =
      findFirstEvent(startupEvents, "main module evaluated") ??
      findFirstEvent(startupEvents, "react root render scheduled");
    const startupReady =
      findFirstEvent(startupEvents, "milkdown: editor ready") ??
      findFirstEvent(startupEvents, "milkdown: create done");
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
              workspaceListMs: durationBetween(
                startupStart,
                findFirstEvent(startupEvents, "workspace bootstrap: list done") ?? startupReady,
              ),
              initialBundleMs: durationBetween(
                startupStart,
                findFirstEvent(startupEvents, "workspace bootstrap: initial bundle done") ??
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
        name: "create_workspace_via_ui",
        kind: "workflow",
        iterations,
        warmupIterations,
        action: async (iteration) => {
          const workspaceName = uniqueName(`Perf Created Workspace ${iteration}`);
          await markPerf("wdio:workspace-name", { workspaceName });
          await safeClick("[data-testid='sidebar-more-trigger']");
          await safeClick("[data-testid='sidebar-new-workspace']");
          await safeSetValue("[data-testid='app-prompt-input']", workspaceName);
          await safeClick("[data-testid='app-dialog-confirm']");
        },
        settle: async () => {
          const events = await snapshotPerfEvents();
          const workspaceName = eventPayloadRecord(
            findLastEvent(events, "wdio:workspace-name"),
          )?.workspaceName;
          if (typeof workspaceName !== "string") {
            throw new Error("missing workspace name");
          }
          await browser.waitUntil(
            async () => {
              const workspace = (await listWorkspaces()).find(
                (entry) => entry.name === workspaceName,
              );
              if (!workspace) {
                return false;
              }
              return (await currentWorkspaceId()) === workspace.id;
            },
            { timeout: 30000, interval: 200 },
          );
          await $("[data-testid='recipe-empty-add-fragment']").waitForDisplayed({ timeout: 20000 });
        },
      }),
      await measureScenario({
        name: "create_fragment_via_ui",
        kind: "workflow",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.workflowWorkspaceId);
          await safeClick("[data-testid='main-tab-edit']");
        },
        action: async (iteration) => {
          const fragmentName = uniqueName(`Perf Fragment ${iteration}`);
          await markPerf("wdio:fragment-name", { fragmentName });
          await safeClick("[data-testid='recipe-add-fragment-menu']");
          await safeClick("[data-testid='fragments-new']");
          await safeSetValue("[data-testid='app-prompt-input']", fragmentName);
          await safeClick("[data-testid='app-dialog-confirm']");
        },
        settle: async () => {
          const events = await snapshotPerfEvents();
          const fragmentName = eventPayloadRecord(
            findLastEvent(events, "wdio:fragment-name"),
          )?.fragmentName;
          if (typeof fragmentName !== "string") {
            throw new Error("missing fragment name");
          }
          const bundle = await browser.waitUntil(
            async () => {
              const nextBundle = await loadWorkspace(context.workflowWorkspaceId);
              return nextBundle.fragments.some((entry) => entry.name === fragmentName)
                ? nextBundle
                : false;
            },
            { timeout: 30000, interval: 200 },
          );
          const created = bundle.fragments.find((entry) => entry.name === fragmentName);
          if (!created) {
            throw new Error("created fragment missing");
          }
          await safeClick(`[data-testid='recipe-item-select-${created.id}']`);
          await waitForFragmentEditorReady();
          await waitForFragmentLabel(fragmentName);
        },
      }),
      await measureScenario({
        name: "switch_current_recipe_small_to_small",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.smallA.id}']`);
          await waitForFragmentLabel(context.fragments.smallA.name);
        },
        action: async () => {
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.smallB.id}']`);
        },
        settle: async () => {
          await waitForEditorDocument(context.fragments.smallB.id, context.fragments.smallB.name);
        },
        analyze: (events) => summarizeSwitchSample(events, context.fragments.smallB.id),
      }),
      await measureScenario({
        name: "switch_current_recipe_small_to_large",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.smallA.id}']`);
          await waitForFragmentLabel(context.fragments.smallA.name);
        },
        action: async () => {
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.largeA.id}']`);
        },
        settle: async () => {
          await waitForEditorDocument(
            context.fragments.largeA.id,
            context.fragments.largeA.name,
            30000,
          );
        },
        analyze: (events) => summarizeSwitchSample(events, context.fragments.largeA.id),
      }),
      await measureScenario({
        name: "switch_current_recipe_large_to_small",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.largeA.id}']`);
          await waitForFragmentLabel(context.fragments.largeA.name);
        },
        action: async () => {
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.smallA.id}']`);
        },
        settle: async () => {
          await waitForEditorDocument(context.fragments.smallA.id, context.fragments.smallA.name);
        },
        analyze: (events) => summarizeSwitchSample(events, context.fragments.smallA.id),
      }),
      await measureScenario({
        name: "first_input_small_doc",
        kind: "editor",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.smallA.id}']`);
          await waitForFragmentLabel(context.fragments.smallA.name);
          await focusFragmentEditor();
        },
        action: async (iteration) => {
          await typeInFragmentEditor(`s${iteration}`);
        },
        settle: async () => {
          await waitForPerfEvent(
            "milkdown: markdown updated",
            (event) => hasDocumentId(event, context.fragments.smallA.id),
            20000,
          );
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const updated = findLastEvent(events, "milkdown: markdown updated", (event) =>
            hasDocumentId(event, context.fragments.smallA.id),
          );
          return {
            totalMs: durationBetween(start, updated),
            markerBreakdown: {
              inputToMarkdownUpdatedMs: durationBetween(start, updated),
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
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.largeA.id}']`);
          await waitForFragmentLabel(context.fragments.largeA.name);
          await focusFragmentEditor();
        },
        action: async (iteration) => {
          await typeInFragmentEditor(`l${iteration}`);
        },
        settle: async () => {
          await waitForPerfEvent(
            "milkdown: markdown updated",
            (event) => hasDocumentId(event, context.fragments.largeA.id),
            30000,
          );
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const updated = findLastEvent(events, "milkdown: markdown updated", (event) =>
            hasDocumentId(event, context.fragments.largeA.id),
          );
          return {
            totalMs: durationBetween(start, updated),
            markerBreakdown: {
              inputToMarkdownUpdatedMs: durationBetween(start, updated),
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
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.autosave.id}']`);
          await waitForFragmentLabel(context.fragments.autosave.name);
          const bundle = await loadWorkspace(context.analysisWorkspace.id);
          const fragment = bundle.fragments.find(
            (entry) => entry.id === context.fragments.autosave.id,
          );
          const suffix = ` autosave-${iteration}`;
          if (!fragment) {
            throw new Error("autosave fragment missing");
          }
          await focusFragmentEditor();
          await typeInFragmentEditor(suffix);
          await markPerf("wdio:autosave-expected", {
            content: `${fragment.content}${suffix}`,
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
          await browser.waitUntil(
            async () => {
              const bundle = await loadWorkspace(context.analysisWorkspace.id);
              return (
                bundle.fragments.find((entry) => entry.id === context.fragments.autosave.id)
                  ?.content === expected
              );
            },
            { timeout: 30000, interval: 200 },
          );
        },
      }),
      await measureScenario({
        name: "switch_to_preview_tab",
        kind: "navigation",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick("[data-testid='main-tab-edit']");
          await safeClick(`[data-testid='recipe-item-select-${context.fragments.smallA.id}']`);
          await waitForFragmentLabel(context.fragments.smallA.name);
        },
        action: async () => {
          await safeClick("[data-testid='main-tab-preview']");
        },
        settle: async () => {
          await waitForPerfEvent(
            "main-tab ready:preview",
            (event) => eventPayloadRecord(event)?.workspaceId === context.analysisWorkspace.id,
            20000,
          );
          await $("[data-testid='preview-open-target-folder']").waitForDisplayed({
            timeout: 20000,
          });
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const ready = findLastEvent(events, "main-tab ready:preview");
          return {
            totalMs: durationBetween(start, ready),
            markerBreakdown: {
              previewReadyMs: durationBetween(start, ready),
            },
          };
        },
      }),
      await measureScenario({
        name: "switch_to_history_tab",
        kind: "navigation",
        iterations,
        warmupIterations,
        prepare: async () => {
          await selectWorkspaceById(context.analysisWorkspace.id);
          await safeClick("[data-testid='main-tab-edit']");
        },
        action: async () => {
          await safeClick("[data-testid='main-tab-history']");
        },
        settle: async () => {
          await waitForPerfEvent("main-tab ready:history", undefined, 20000);
          await $("[data-testid='history-diff']").waitForDisplayed({ timeout: 20000 });
        },
        analyze: (events) => {
          const start = findLastEvent(events, "wdio:scenario-start");
          const ready = findLastEvent(events, "main-tab ready:history");
          return {
            totalMs: durationBetween(start, ready),
            markerBreakdown: {
              historyReadyMs: durationBetween(start, ready),
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
      startupWorkspaceId: context.startupWorkspace.id,
      workflowWorkspaceId: context.workflowWorkspaceId,
      analysisWorkspaceId: context.analysisWorkspace.id,
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
