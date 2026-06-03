import { initialUI, useAppStore } from "@/store/appStore";
import type { AppState } from "@/store/types";

type ScreenshotScenarioId = "default" | "edit-fragment" | "preview" | "history" | "library-insert";

type ScreenshotScenario = {
  app: Pick<AppState, "workspaces" | "fragments" | "recipes" | "recipeItems" | "snapshots">;
  activeWorkspaceId: string | null;
  activeRecipeId: string | null;
  activeFragmentId: string | null;
  selectedSnapshotId: string | null;
  compileStatus: AppState["compileStatus"];
  workspaceStatusMessage: string | null;
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

export function getScreenshotScenarioId(): ScreenshotScenarioId | null {
  const raw = searchParams()?.get("screenshot");
  if (!raw) {
    return null;
  }
  const allowed = new Set<ScreenshotScenarioId>([
    "default",
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

const screenshotScenarioDefault: ScreenshotScenario = {
  app: {
    workspaces: [
      {
        id: "workspace-screenshot",
        name: "E2E Workspace 1779597644735",
        targetPath: null,
        defaultRecipeId: "recipe-default",
        status: "missing_target",
        lastCompiledAt: "2026-06-02 20:42",
        lastCompiledHash: "compiled-hash-default",
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
    ],
    fragments: [
      {
        id: "fragment-intro",
        workspaceId: "workspace-screenshot",
        name: "Intro",
        content: "Intro body",
        contentHash: "hash-intro",
        sortOrder: 0,
        isArchived: false,
        deletedAt: null,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
      {
        id: "fragment-middle",
        workspaceId: "workspace-screenshot",
        name: "Middle",
        content: "Middle body",
        contentHash: "hash-middle",
        sortOrder: 1,
        isArchived: false,
        deletedAt: null,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
      {
        id: "fragment-outro",
        workspaceId: "workspace-screenshot",
        name: "Outro",
        content: "Outro body",
        contentHash: "hash-outro",
        sortOrder: 2,
        isArchived: false,
        deletedAt: null,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
      {
        id: "fragment-unknown",
        workspaceId: "workspace-screenshot",
        name: "Unknown fragment",
        content: "Empty fragment",
        contentHash: "hash-unknown",
        sortOrder: 3,
        isArchived: false,
        deletedAt: null,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
      {
        id: "fragment-test",
        workspaceId: "workspace-screenshot",
        name: "test",
        content: "test123",
        contentHash: "hash-test",
        sortOrder: 4,
        isArchived: false,
        deletedAt: null,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
      {
        id: "fragment-library-only",
        workspaceId: "workspace-screenshot",
        name: "Appendix",
        content: "Library-only body",
        contentHash: "hash-library",
        sortOrder: 5,
        isArchived: false,
        deletedAt: null,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
      },
    ],
    recipes: [
      {
        id: "recipe-default",
        workspaceId: "workspace-screenshot",
        name: "Default",
        description: "",
        isActive: true,
        createdAt: "2026-06-02T19:00:00.000Z",
        updatedAt: "2026-06-03T12:00:00.000Z",
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
    snapshots: [
      {
        id: "snapshot-baseline",
        workspaceId: "workspace-screenshot",
        recipeId: "recipe-default",
        label: "Baseline snapshot",
        compiledText: "Intro body\n\n---\n\nMiddle body\n\n---\n\nOutro body",
        compiledHash: "snapshot-hash-1",
        createdAt: "2026-06-02 18:15",
      },
      {
        id: "snapshot-latest",
        workspaceId: "workspace-screenshot",
        recipeId: "recipe-default",
        label: "Latest snapshot",
        compiledText: "Intro body\n\n---\n\nMiddle body\n\n---\n\nUnknown fragment",
        compiledHash: "snapshot-hash-2",
        createdAt: "2026-06-03 08:40",
      },
    ],
  },
  activeWorkspaceId: "workspace-screenshot",
  activeRecipeId: "recipe-default",
  activeFragmentId: "fragment-intro",
  selectedSnapshotId: "snapshot-latest",
  compileStatus: "idle",
  workspaceStatusMessage: null,
  ui: {
    theme: "light",
    activeMainTab: "edit",
    sidebarCollapsed: false,
    zenMode: false,
    cheatsheetOpen: false,
  },
  libraryDialog: null,
};

function createScenario(overrides: Partial<ScreenshotScenario>): ScreenshotScenario {
  return {
    ...screenshotScenarioDefault,
    ...overrides,
    app: screenshotScenarioDefault.app,
    ui: {
      ...screenshotScenarioDefault.ui,
      ...overrides.ui,
    },
  };
}

const screenshotScenarios: Record<ScreenshotScenarioId, ScreenshotScenario> = {
  default: screenshotScenarioDefault,
  "edit-fragment": screenshotScenarioDefault,
  preview: createScenario({
    ui: {
      activeMainTab: "preview",
    },
  }),
  history: createScenario({
    ui: {
      activeMainTab: "history",
    },
  }),
  "library-insert": createScenario({
    libraryDialog: "insert",
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
    activeWorkspaceId: scenario.activeWorkspaceId,
    activeRecipeId: scenario.activeRecipeId,
    activeFragmentId: scenario.activeFragmentId,
    selectedSnapshotId: scenario.selectedSnapshotId,
    compileStatus: scenario.compileStatus,
    workspaceStatusMessage: scenario.workspaceStatusMessage,
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

  const needsDialog = getScreenshotDialogMode() !== null;
  if (needsDialog && !document.querySelector('[role="dialog"]')) {
    return false;
  }

  if (
    (scenarioId === "default" || scenarioId === "edit-fragment") &&
    !document.querySelector("#fragment-editor .ProseMirror, #fragment-editor textarea")
  ) {
    return false;
  }

  return Boolean(
    document.querySelector("[data-testid='main-tab-edit']") ||
      document.querySelector("[data-testid='main-tab-preview']") ||
      document.querySelector("[data-testid='main-tab-history']"),
  );
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
  if (!scenarioId || !capturePort) {
    return false;
  }

  try {
    const ready = await waitForScreenshotScene();
    if (!ready) {
      console.warn("Screenshot scene did not fully stabilize before capture");
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
    console.error("Failed to report screenshot readiness", error);
    return false;
  }
}
