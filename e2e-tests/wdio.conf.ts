import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Options } from "@wdio/types";

let tauriDriver: ChildProcess | undefined;
let viteServer: ChildProcess | undefined;
let cleanupRegistered = false;

type E2eMode = "dist" | "dev";

const appName = "modudoc";
const appBinary = process.platform === "win32" ? `${appName}.exe` : appName;
const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(configDir, "..");

function resolveE2eMode(): E2eMode {
  const raw = (process.env.MODUDOC_E2E_MODE ?? "").trim().toLowerCase();
  if (!raw || raw === "dist" || raw === "frontenddist" || raw === "prod" || raw === "production") {
    return "dist";
  }
  if (raw === "dev" || raw === "vite" || raw === "devserver") {
    return "dev";
  }
  throw new Error(
    `Unknown MODUDOC_E2E_MODE=${JSON.stringify(process.env.MODUDOC_E2E_MODE)} (expected "dist" or "dev")`,
  );
}

function resolveNumberEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}=${JSON.stringify(raw)} (expected a positive integer)`);
  }
  return parsed;
}

function resolveAvailablePort(): number {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const net=require('net');const s=net.createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});`,
    ],
    { encoding: "utf8", shell: false },
  );

  const port = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number.parseInt(line, 10))
    .find((candidate) => Number.isFinite(candidate) && candidate > 0);

  if (!port) {
    throw new Error(`Failed to resolve an available TCP port (exit=${result.status ?? "null"})`);
  }

  return port;
}

function resolveTauriDriverPorts(): { port: number; nativePort: number } {
  const port = resolveNumberEnv("MODUDOC_E2E_WD_PORT") ?? resolveAvailablePort();
  let nativePort = resolveNumberEnv("MODUDOC_E2E_WD_NATIVE_PORT");
  if (!nativePort) {
    do {
      nativePort = resolveAvailablePort();
    } while (nativePort === port);
  }
  return { port, nativePort };
}

const e2eMode = resolveE2eMode();

function ensureTauriDriverPortsAssigned() {
  if (process.env.MODUDOC_E2E_WD_PORT && process.env.MODUDOC_E2E_WD_NATIVE_PORT) {
    return;
  }

  // WebdriverIO runs some hooks in a different worker process. Avoid generating random ports
  // in a worker process and accidentally diverging from what the launcher selected.
  if (process.env.WDIO_WORKER_ID) {
    process.env.MODUDOC_E2E_WD_PORT ||= "4444";
    process.env.MODUDOC_E2E_WD_NATIVE_PORT ||= "4445";
    return;
  }

  const { port, nativePort } = resolveTauriDriverPorts();
  process.env.MODUDOC_E2E_WD_PORT = String(port);
  process.env.MODUDOC_E2E_WD_NATIVE_PORT = String(nativePort);
}

ensureTauriDriverPortsAssigned();

const tauriDriverPort = resolveNumberEnv("MODUDOC_E2E_WD_PORT") ?? 4444;
const tauriNativePort = resolveNumberEnv("MODUDOC_E2E_WD_NATIVE_PORT") ?? 4445;
const application = path.resolve(
  projectRoot,
  "src-tauri",
  "target",
  e2eMode === "dev" ? "debug" : "release",
  appBinary,
);

function buildE2eDataDir() {
  if (process.env.MODUDOC_E2E_RUN_DIR) {
    return process.env.MODUDOC_E2E_RUN_DIR;
  }
  const root = process.env.MODUDOC_E2E_ROOT || path.join(projectRoot, "tmp", "modudoc-e2e");
  const runId =
    process.env.GITHUB_RUN_ID ||
    process.env.CI_RUN_ID ||
    process.env.CI_JOB_ID ||
    `${Date.now()}-${process.pid}`;
  return path.join(root, `run-${runId}`);
}

function pruneOldRuns(rootDir: string, keep = 3) {
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
      .map((entry) => {
        const fullPath = path.join(rootDir, entry.name);
        let mtimeMs = 0;
        try {
          mtimeMs = statSync(fullPath).mtimeMs;
        } catch {
          mtimeMs = 0;
        }
        return { name: entry.name, fullPath, mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const stale of entries.slice(keep)) {
      try {
        rmSync(stale.fullPath, { recursive: true, force: true });
      } catch {
        // ignore cleanup failures
      }
    }
  } catch {
    // ignore pruning errors
  }
}

function teeChildOutput(child: ChildProcess, outputDir: string, basename: string) {
  const logPath = path.join(outputDir, basename);
  try {
    mkdirSync(outputDir, { recursive: true });
    appendFileSync(logPath, "", "utf8");
  } catch {
    return;
  }

  const append = (chunk: Buffer) => {
    try {
      appendFileSync(logPath, chunk);
    } catch {
      // ignore
    }
  };

  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      append(chunk);
      process.stdout.write(chunk);
    });
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      append(chunk);
      process.stderr.write(chunk);
    });
  }
}

function cleanupChildProcess(child: ChildProcess | undefined) {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }

  if (process.platform === "win32" && child.pid) {
    try {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        cwd: projectRoot,
        stdio: "ignore",
        shell: false,
      });
    } catch {
      // ignore
    }
  }
}

function registerCleanupHandlers() {
  if (cleanupRegistered) {
    return;
  }
  cleanupRegistered = true;

  const cleanup = () => {
    cleanupChildProcess(tauriDriver);
    cleanupChildProcess(viteServer);
  };

  process.once("exit", cleanup);
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });
}

function resolveTauriDriverBin() {
  const override = process.env.TAURI_DRIVER_PATH || process.env.TAURI_DRIVER_BIN;
  if (override && existsSync(override)) {
    return override;
  }
  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, ["tauri-driver"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status === 0) {
    const resolved = result.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
    if (resolved && existsSync(resolved)) {
      return resolved;
    }
  }
  const cargoBin = path.resolve(os.homedir(), ".cargo", "bin", "tauri-driver");
  if (existsSync(cargoBin)) {
    return cargoBin;
  }
  throw new Error("Unable to locate tauri-driver. Set TAURI_DRIVER_PATH to override.");
}

export const config: Options.WebdriverIO = {
  runner: "local",
  host: "127.0.0.1",
  port: tauriDriverPort,
  specs: ["./test/specs/**/*.ts"],
  maxInstances: 1,
  logLevel: "info",
  framework: "mocha",
  reporters: ["spec"],
  autoXvfb: true,
  xvfbAutoInstall: false,
  outputDir: (() => {
    const root = process.env.MODUDOC_E2E_ROOT || path.join(projectRoot, "tmp", "modudoc-e2e");
    const dataDir = buildE2eDataDir();
    const outputDir = process.env.MODUDOC_E2E_OUTPUT_DIR || path.join(dataDir, "logs");
    process.env.MODUDOC_DATA_DIR ||= dataDir;
    process.env.MODUDOC_E2E_OUTPUT_DIR ||= outputDir;
    process.env.MODUDOC_E2E_RUN_DIR ||= dataDir;
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(root, { recursive: true });
    pruneOldRuns(root, 3);
    return process.env.MODUDOC_E2E_OUTPUT_DIR;
  })(),
  waitforTimeout: 20000,
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  capabilities: [
    {
      maxInstances: 1,
      browserName: process.platform === "win32" ? "webview2" : "wry",
      "wdio:enforceWebDriverClassic": true,
      "tauri:options": {
        application,
        webviewOptions: {},
      },
    },
  ],
  onPrepare: () => {
    registerCleanupHandlers();

    // Ensure the output directory exists (WDIO doesn't create it automatically).
    try {
      if (process.env.MODUDOC_E2E_OUTPUT_DIR) {
        mkdirSync(process.env.MODUDOC_E2E_OUTPUT_DIR, { recursive: true });
      }
    } catch {
      // ignore
    }

    if (process.env.MODUDOC_E2E_DIAG === "1") {
      const diag = {
        ts: new Date().toISOString(),
        mode: e2eMode,
        tauriDriverPort,
        tauriNativePort,
        display: process.env.DISPLAY ?? "",
        waylandDisplay: process.env.WAYLAND_DISPLAY ?? "",
        xdgSessionType: process.env.XDG_SESSION_TYPE ?? "",
        gdkBackend: process.env.GDK_BACKEND ?? "",
        dataDir: process.env.MODUDOC_DATA_DIR,
        outputDir: process.env.MODUDOC_E2E_OUTPUT_DIR,
      };

      // 1) Write to a small file so you can inspect it without scrolling logs.
      try {
        mkdirSync(process.env.MODUDOC_DATA_DIR, { recursive: true });
        writeFileSync(
          path.join(process.env.MODUDOC_DATA_DIR, "e2e-diag.json"),
          `${JSON.stringify(diag, null, 2)}\n`,
          "utf8",
        );
      } catch {
        // ignore diagnostics failures
      }

      // 2) Print a single grep-friendly line.
      // eslint-disable-next-line no-console
      console.log(
        "[MODUDOC_E2E_DIAG] MODE=%s WD_PORT=%s WD_NATIVE_PORT=%s DISPLAY=%s WAYLAND_DISPLAY=%s XDG_SESSION_TYPE=%s GDK_BACKEND=%s DATA_DIR=%s OUTPUT_DIR=%s",
        diag.mode,
        diag.tauriDriverPort,
        diag.tauriNativePort,
        diag.display,
        diag.waylandDisplay,
        diag.xdgSessionType,
        diag.gdkBackend,
        diag.dataDir,
        diag.outputDir,
      );
    }

    if (e2eMode === "dev") {
      const viteBin = path.resolve(projectRoot, "node_modules", "vite", "bin", "vite.js");
      viteServer = spawn(
        process.execPath,
        [viteBin, "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        {
          cwd: projectRoot,
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
        },
      );
      if (process.env.MODUDOC_E2E_OUTPUT_DIR) {
        teeChildOutput(viteServer, process.env.MODUDOC_E2E_OUTPUT_DIR, "vite.log");
      }
      spawnSync(
        "cargo",
        ["build", "--manifest-path", path.join(projectRoot, "src-tauri", "Cargo.toml")],
        {
          cwd: projectRoot,
          stdio: "inherit",
          shell: false,
        },
      );
    } else {
      spawnSync("npx", ["--no-install", "tauri", "build", "--no-bundle"], {
        cwd: projectRoot,
        stdio: "inherit",
        shell: false,
      });
    }
  },
  beforeSession: () => {
    tauriDriver = spawn(
      resolveTauriDriverBin(),
      ["--port", String(tauriDriverPort), "--native-port", String(tauriNativePort)],
      {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      },
    );
    if (process.env.MODUDOC_E2E_OUTPUT_DIR && tauriDriver) {
      teeChildOutput(tauriDriver, process.env.MODUDOC_E2E_OUTPUT_DIR, "tauri-driver.log");
    }
  },
  before: async () => {
    await browser.setWindowSize(1280, 900);
  },
  afterSession: () => {
    cleanupChildProcess(tauriDriver);
    tauriDriver = undefined;
    cleanupChildProcess(viteServer);
    viteServer = undefined;
  },
  onComplete: () => {
    cleanupChildProcess(tauriDriver);
    tauriDriver = undefined;
    cleanupChildProcess(viteServer);
    viteServer = undefined;
  },
};

export default config;
