import { initialUI, useAppStore } from "@/store/appStore";
import type { AppState, DocumentSaveState } from "@/store/types";

type ScreenshotScenarioId =
  | "default"
  | "project-ready"
  | "edit-fragment"
  | "preview"
  | "history"
  | "library-insert";

type ScreenshotScenario = {
  app: Pick<
    AppState,
    "projects" | "documents" | "fragments" | "recipes" | "recipeItems" | "snapshotsByDocumentId"
  >;
  activeProjectId: string | null;
  activeDocumentId: string | null;
  selectedSnapshotId: string | null;
  documentProcessStatus: AppState["documentProcessStatus"];
  documentStatusMessage: AppState["documentStatusMessage"];
  ui: Partial<AppState["ui"]>;
  libraryDialog?: "insert" | null;
};

export type ScreenshotCapturePayload = {
  scenarioId: ScreenshotScenarioId;
  scaleFactor: number;
  devicePixelRatio: number;
  outerPosition: { x: number; y: number } | null;
  outerSize: { width: number; height: number } | null;
  innerPosition: { x: number; y: number } | null;
  innerSize: { width: number; height: number } | null;
  viewport: { width: number; height: number };
};

function searchParams() {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search);
}

function getCapturePort() {
  const raw = searchParams()?.get("capturePort");
  if (!raw) {
    return null;
  }
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : null;
}

function setScreenshotReadyState(state: "pending" | "true" | "timeout" | "error") {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.screenshotReady = state;
}

export function getScreenshotScenarioId(): ScreenshotScenarioId | null {
  const raw = searchParams()?.get("screenshot");
  if (!raw) {
    return null;
  }
  const allowed = new Set<ScreenshotScenarioId>([
    "default",
    "project-ready",
    "edit-fragment",
    "preview",
    "history",
    "library-insert",
  ]);
  if (allowed.has(raw as ScreenshotScenarioId)) {
    return raw as ScreenshotScenarioId;
  }
  return "default";
}

export function isScreenshotMode() {
  return getScreenshotScenarioId() !== null;
}

const DOC_BASE = "2026-06-02T19:00:00.000Z";
const DOC_UPDATED = "2026-06-03T12:00:00.000Z";
const FIRST_RUN_UPDATED = "2026-06-09T14:19:54.000Z";

const screenshotScenarioReadyState: ScreenshotScenario = {
  app: {
    projects: [
      {
        id: "project-screenshot",
        name: "E2E Project 1779597644735",
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
    ],
    documents: [
      {
        id: "document-main",
        projectId: "project-screenshot",
        name: "Untitled.md",
        content: "Main document body",
        contentHash: "hash-main",
        targetPath: "/tmp/main.md",
        saveState: "saved" satisfies DocumentSaveState,
        lastWrittenAt: "2026-06-03T08:40:00.000Z",
        lastWrittenHash: "written-hash-main",
        sortOrder: 0,
        deletedAt: null,
        description: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
    ],
    fragments: [
      {
        id: "fragment-intro",
        projectId: "project-screenshot",
        name: "Intro",
        content: "Intro body",
        contentHash: "hash-intro",
        tags: "",
        category: null,
        sortOrder: 0,
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
      {
        id: "fragment-middle",
        projectId: "project-screenshot",
        name: "Middle",
        content: "Middle body",
        contentHash: "hash-middle",
        tags: "",
        category: null,
        sortOrder: 1,
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
      {
        id: "fragment-outro",
        projectId: "project-screenshot",
        name: "Outro",
        content: "Outro body",
        contentHash: "hash-outro",
        tags: "",
        category: null,
        sortOrder: 2,
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
      {
        id: "fragment-unknown",
        projectId: "project-screenshot",
        name: "Unknown fragment",
        content: "Empty fragment",
        contentHash: "hash-unknown",
        tags: "",
        category: null,
        sortOrder: 3,
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
      {
        id: "fragment-test",
        projectId: "project-screenshot",
        name: "test",
        content: "test123",
        contentHash: "hash-test",
        tags: "",
        category: null,
        sortOrder: 4,
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
      {
        id: "fragment-library-only",
        projectId: "project-screenshot",
        name: "Appendix",
        content: "Library-only body",
        contentHash: "hash-library",
        tags: "",
        category: null,
        sortOrder: 5,
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
    ],
    recipes: [
      {
        id: "recipe-default",
        projectId: "project-screenshot",
        name: "Default",
        description: "",
        deletedAt: null,
        createdAt: DOC_BASE,
        updatedAt: DOC_UPDATED,
      },
    ],
    recipeItems: [
      {
        id: "recipe-item-intro",
        recipeId: "recipe-default",
        fragmentId: "fragment-intro",
        enabled: true,
        sortOrder: 0,
      },
      {
        id: "recipe-item-middle",
        recipeId: "recipe-default",
        fragmentId: "fragment-middle",
        enabled: true,
        sortOrder: 1,
      },
      {
        id: "recipe-item-outro",
        recipeId: "recipe-default",
        fragmentId: "fragment-outro",
        enabled: false,
        sortOrder: 2,
      },
      {
        id: "recipe-item-unknown",
        recipeId: "recipe-default",
        fragmentId: "fragment-unknown",
        enabled: true,
        sortOrder: 3,
      },
      {
        id: "recipe-item-test",
        recipeId: "recipe-default",
        fragmentId: "fragment-test",
        enabled: false,
        sortOrder: 4,
      },
    ],
    snapshotsByDocumentId: {
      "document-main": [
        {
          id: "snapshot-baseline",
          documentId: "document-main",
          label: "Baseline snapshot",
          content: "Intro body\n\n---\n\nMiddle body\n\n---\n\nOutro body",
          contentHash: "snapshot-hash-1",
          createdAt: "2026-06-02 18:15",
        },
        {
          id: "snapshot-latest",
          documentId: "document-main",
          label: "Latest snapshot",
          content: "Intro body\n\n---\n\nMiddle body\n\n---\n\nUnknown fragment",
          contentHash: "snapshot-hash-2",
          createdAt: "2026-06-03 08:40",
        },
      ],
    },
  },
  activeProjectId: "project-screenshot",
  activeDocumentId: "document-main",
  selectedSnapshotId: "snapshot-latest",
  documentProcessStatus: { "document-main": "idle" },
  documentStatusMessage: {},
  ui: {
    theme: "light",
    centerMode: "edit",
    rightPanelCollapsed: true,
    zenMode: false,
    cheatsheetOpen: false,
    settingsDialogOpen: false,
  },
  libraryDialog: null,
};

const screenshotScenarioFirstRun: ScreenshotScenario = {
  app: {
    projects: [
      {
        id: "project-1",
        name: "Untitled Project",
        createdAt: DOC_BASE,
        updatedAt: FIRST_RUN_UPDATED,
      },
      {
        id: "project-2",
        name: "Untitled Project",
        createdAt: DOC_BASE,
        updatedAt: FIRST_RUN_UPDATED,
      },
      {
        id: "project-3",
        name: "Untitled Project",
        createdAt: DOC_BASE,
        updatedAt: FIRST_RUN_UPDATED,
      },
      {
        id: "project-4",
        name: "Untitled Project",
        createdAt: DOC_BASE,
        updatedAt: FIRST_RUN_UPDATED,
      },
    ],
    documents: [
      {
        id: "document-main",
        projectId: "project-4",
        name: "Untitled.md",
        content: "",
        contentHash: "hash-main-empty",
        targetPath: null,
        saveState: "draft" satisfies DocumentSaveState,
        lastWrittenAt: null,
        lastWrittenHash: null,
        sortOrder: 0,
        deletedAt: null,
        description: null,
        createdAt: DOC_BASE,
        updatedAt: FIRST_RUN_UPDATED,
      },
    ],
    fragments: [],
    recipes: [],
    recipeItems: [],
    snapshotsByDocumentId: {},
  },
  activeProjectId: "project-4",
  activeDocumentId: "document-main",
  selectedSnapshotId: null,
  documentProcessStatus: { "document-main": "idle" },
  documentStatusMessage: {},
  ui: {
    theme: "light",
    centerMode: "edit",
    rightPanelCollapsed: true,
    zenMode: false,
    cheatsheetOpen: false,
    settingsDialogOpen: false,
  },
  libraryDialog: null,
};

function createScenario(
  base: ScreenshotScenario,
  overrides: Partial<ScreenshotScenario>,
): ScreenshotScenario {
  return {
    ...base,
    ...overrides,
    app: base.app,
    ui: {
      ...base.ui,
      ...overrides.ui,
    },
  };
}

const screenshotScenarios: Record<ScreenshotScenarioId, ScreenshotScenario> = {
  default: screenshotScenarioFirstRun,
  "project-ready": screenshotScenarioReadyState,
  "edit-fragment": screenshotScenarioReadyState,
  preview: createScenario(screenshotScenarioReadyState, {
    ui: {
      centerMode: "preview",
    },
  }),
  history: createScenario(screenshotScenarioReadyState, {
    ui: {
      centerMode: "history",
    },
  }),
  "library-insert": createScenario(screenshotScenarioReadyState, {
    ui: {
      rightPanelCollapsed: false,
      rightPanelTab: "fragments",
    },
    libraryDialog: null,
  }),
};

export function applyScreenshotScenario() {
  const scenarioId = getScreenshotScenarioId();
  if (!scenarioId) {
    return false;
  }

  const scenario = screenshotScenarios[scenarioId];
  const current = useAppStore.getState();

  useAppStore.setState({
    ...current,
    ...scenario.app,
    activeProjectId: scenario.activeProjectId,
    activeDocumentId: scenario.activeDocumentId,
    selectedSnapshotId: scenario.selectedSnapshotId,
    documentProcessStatus: scenario.documentProcessStatus,
    documentStatusMessage: scenario.documentStatusMessage,
    ui: {
      ...initialUI,
      ...scenario.ui,
    },
  });

  return true;
}

export function getScreenshotDialogMode() {
  const scenarioId = getScreenshotScenarioId();
  if (!scenarioId) {
    return null;
  }
  return screenshotScenarios[scenarioId].libraryDialog ?? null;
}

async function waitForStablePaint() {
  if ("fonts" in document) {
    await document.fonts.ready;
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function screenshotSceneLooksReady() {
  const appShell = document.querySelector(".app-shell");
  if (!appShell) {
    return false;
  }

  const scenarioId = getScreenshotScenarioId();
  if (!scenarioId) {
    return false;
  }

  const visibleText = document.body.innerText.replace(/\s+/g, " ").trim();
  if (visibleText.length < 40) {
    return false;
  }

  if (
    !document.querySelector("[data-testid='document-header']") ||
    !document.querySelector("[data-testid='target-bar']")
  ) {
    return false;
  }

  if (
    (scenarioId === "default" ||
      scenarioId === "project-ready" ||
      scenarioId === "edit-fragment") &&
    !document.querySelector("[data-testid='editor-pane-textarea']")
  ) {
    return false;
  }

  if (scenarioId === "preview" && !document.querySelector(".preview-pane")) {
    return false;
  }

  if (scenarioId === "history" && !document.querySelector(".history-view")) {
    return false;
  }

  if (scenarioId === "library-insert" && !document.querySelector(".right-panel")) {
    return false;
  }

  return Boolean(document.querySelector(".document-editor"));
}

async function waitForScreenshotScene(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await waitForStablePaint();
    if (screenshotSceneLooksReady()) {
      return true;
    }
    await sleep(120);
  }
  return false;
}

function normalizePoint(value: { x: number; y: number } | null | undefined) {
  if (!value) {
    return null;
  }
  return { x: value.x, y: value.y };
}

function normalizeSize(value: { width: number; height: number } | null | undefined) {
  if (!value) {
    return null;
  }
  return { width: value.width, height: value.height };
}

export async function reportScreenshotReady() {
  const scenarioId = getScreenshotScenarioId();
  const capturePort = getCapturePort();
  if (!scenarioId) {
    return false;
  }

  try {
    document.documentElement.dataset.screenshotScenario = scenarioId;
    setScreenshotReadyState("pending");
    const ready = await waitForScreenshotScene();
    if (!ready) {
      console.warn("Screenshot scene did not fully stabilize before capture");
    }
    setScreenshotReadyState(ready ? "true" : "timeout");

    if (!capturePort) {
      return ready;
    }

    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    await appWindow.setFocus().catch(() => undefined);

    const [scaleFactor, outerPosition, outerSize, innerPosition, innerSize] = await Promise.all([
      appWindow.scaleFactor(),
      appWindow.outerPosition().catch(() => null),
      appWindow.outerSize().catch(() => null),
      appWindow.innerPosition().catch(() => null),
      appWindow.innerSize().catch(() => null),
    ]);

    const payload: ScreenshotCapturePayload = {
      scenarioId,
      scaleFactor,
      devicePixelRatio: window.devicePixelRatio,
      outerPosition: normalizePoint(outerPosition),
      outerSize: normalizeSize(outerSize),
      innerPosition: normalizePoint(innerPosition),
      innerSize: normalizeSize(innerSize),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    await fetch(`http://127.0.0.1:${capturePort}/ready`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    setScreenshotReadyState("error");
    console.error("Failed to report screenshot readiness", error);
    return false;
  }
}
