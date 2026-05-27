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
let windowsWebDriver: ChildProcess | undefined;
let windowsApp: ChildProcess | undefined;
let cleanupRegistered = false;

type E2eMode = "dist" | "dev";
type WindowsDriverStrategy = "tauri-driver" | "attach";

const appName = "modudoc";
const appBinary = process.platform === "win32" ? `${appName}.exe` : appName;
const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(configDir, "..");
function runTauriCli(args: string[]) {
  const tauriCliEntry = path.resolve(projectRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
  if (!existsSync(tauriCliEntry)) {
    throw new Error(`Unable to locate @tauri-apps/cli entry at ${JSON.stringify(tauriCliEntry)}`);
  }

  const result = spawnSync(process.execPath, [tauriCliEntry, ...args], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  });

  return result;
}

const isWindows = process.platform === "win32";

let cachedMsEdgeDriverBin: string | undefined;
let cachedTauriDriverBin: string | undefined;

function withPlatformExeSuffix(basename: string) {
  return isWindows && !basename.toLowerCase().endsWith(".exe") ? `${basename}.exe` : basename;
}

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

function resolveWindowsDriverStrategy(): WindowsDriverStrategy {
  const raw = (process.env.MODUDOC_E2E_WINDOWS_STRATEGY ?? "").trim().toLowerCase();
  if (!raw) {
    // Default to the more reliable attach strategy on CI.
    return process.env.CI ? "attach" : "tauri-driver";
  }
  if (raw === "tauri-driver" || raw === "tauridirver" || raw === "tauri") {
    return "tauri-driver";
  }
  if (raw === "attach" || raw === "debuggeraddress" || raw === "debugger-address") {
    return "attach";
  }
  throw new Error(
    `Unknown MODUDOC_E2E_WINDOWS_STRATEGY=${JSON.stringify(process.env.MODUDOC_E2E_WINDOWS_STRATEGY)} (expected "tauri-driver" or "attach")`,
  );
}

const windowsDriverStrategy: WindowsDriverStrategy =
  process.platform === "win32" ? resolveWindowsDriverStrategy() : "tauri-driver";

const windowsAttachEnabled = process.platform === "win32" && windowsDriverStrategy === "attach";

function parseWorkerIndex(cid: string): number {
  const parts = cid.split("-").map((value) => Number.parseInt(value, 10));
  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value) || value < 0)) {
    return 0;
  }
  // cid format is "{capabilityIndex}-{specIndex}".
  return parts[0] * 100 + parts[1];
}

function resolveWindowsAttachWorkerPorts(cid: string): {
  edgeDriverPort: number;
  webViewDebugPort: number;
} {
  const workerIndex = parseWorkerIndex(cid);
  const edgeBase = resolveNumberEnv("MODUDOC_E2E_EDGE_DRIVER_PORT_BASE") ?? 51000;
  const debugBase = resolveNumberEnv("MODUDOC_E2E_WEBVIEW_DEBUG_PORT_BASE") ?? 52000;
  return {
    edgeDriverPort: edgeBase + workerIndex,
    webViewDebugPort: debugBase + workerIndex,
  };
}

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

function resolveConfiguredAppBinaryPath(): string {
  const override = process.env.MODUDOC_E2E_APP_PATH?.trim();
  if (override) {
    return override;
  }

  const profileDir = e2eMode === "dev" ? "debug" : "release";
  return path.resolve(projectRoot, "src-tauri", "target", profileDir, appBinary);
}

function resolveMsEdgeDriverBin() {
  if (cachedMsEdgeDriverBin && existsSync(cachedMsEdgeDriverBin)) {
    return cachedMsEdgeDriverBin;
  }

  const override = process.env.MSEDGEDRIVER_PATH || process.env.MSEDGEDRIVER_BIN;
  if (override && existsSync(override)) {
    cachedMsEdgeDriverBin = override;
    return override;
  }
  const result = spawnSync("where", ["msedgedriver"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status === 0) {
    const resolved = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (resolved && existsSync(resolved)) {
      cachedMsEdgeDriverBin = resolved;
      return resolved;
    }
  }

  // Try to download a matching driver via the (already lockfile-pinned) `edgedriver` npm package.
  // This avoids requiring manual PATH setup on fresh Windows environments.
  const e2eRoot = process.env.MODUDOC_E2E_ROOT || path.join(projectRoot, "tmp", "modudoc-e2e");
  const cacheDir = path.join(e2eRoot, "drivers");
  try {
    mkdirSync(cacheDir, { recursive: true });
  } catch {
    // ignore
  }

  const download = spawnSync(
    process.execPath,
    [
      "-e",
      `import('edgedriver').then(m=>m.download(undefined,${JSON.stringify(
        cacheDir,
      )}).then(p=>{console.log(String(p||''))}).catch(e=>{console.error(e?.stack||String(e));process.exit(1);})).catch(e=>{console.error(e?.stack||String(e));process.exit(1);});`,
    ],
    { cwd: projectRoot, encoding: "utf8", shell: false },
  );
  if (download.status === 0) {
    const downloadedPath = (download.stdout || "")
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0];
    if (downloadedPath && existsSync(downloadedPath)) {
      cachedMsEdgeDriverBin = downloadedPath;
      return downloadedPath;
    }
  }

  throw new Error(
    "Unable to locate msedgedriver.exe. Ensure it is on PATH, set MSEDGEDRIVER_PATH, or ensure the `edgedriver` npm package can download it.",
  );
}

function parseDebuggerPort(debuggerAddress: unknown): number | undefined {
  if (typeof debuggerAddress !== "string") return undefined;
  const match = debuggerAddress.match(/:(\d+)$/);
  if (!match) return undefined;
  const port = Number.parseInt(match[1], 10);
  return Number.isFinite(port) && port > 0 ? port : undefined;
}

function waitForTcpPort(hostname: string, port: number, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `const net=require('net');const s=net.connect(${port},${JSON.stringify(
          hostname,
        )});s.on('connect',()=>{process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),500);`,
      ],
      { cwd: projectRoot, stdio: "ignore", shell: false },
    );
    if (result.status === 0) {
      return;
    }
  }
  throw new Error(`Timed out waiting for TCP port ${hostname}:${port} to become available`);
}

function fetchWebDriverStatus(hostname: string, port: number) {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const http=require('http');const req=http.request({hostname:${JSON.stringify(
        hostname,
      )},port:${port},path:'/status',method:'GET'},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>{console.log(body)});});req.on('error',err=>{console.error(String(err));process.exit(1)});req.end();`,
    ],
    { cwd: projectRoot, encoding: "utf8", shell: false },
  );
  if (result.status !== 0) {
    throw new Error(
      `Failed to query WebDriver status (exit=${result.status ?? "null"}): ${result.stderr || ""}`.trim(),
    );
  }
  return (result.stdout || "").trim();
}

function findBuiltAppBinaryPath(): string {
  const configured = resolveConfiguredAppBinaryPath();
  if (existsSync(configured)) {
    return configured;
  }

  const profileDir = e2eMode === "dev" ? "debug" : "release";
  const baseDir = path.resolve(projectRoot, "src-tauri", "target");

  try {
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = path.join(baseDir, entry.name, profileDir, appBinary);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // ignore discovery failures
  }

  return configured;
}

const application = resolveConfiguredAppBinaryPath();

function buildE2eDataDir() {
  if (process.env.MODUDOC_E2E_RUN_DIR) {
    return process.env.MODUDOC_E2E_RUN_DIR;
  }
  const root = process.env.MODUDOC_E2E_ROOT || path.join(projectRoot, "tmp", "modudoc-e2e");
  const sanitizeRunId = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 120);

  const explicitRunId = (process.env.MODUDOC_E2E_RUN_ID ?? "").trim();
  if (explicitRunId) {
    const runId = sanitizeRunId(explicitRunId) || `local-${process.pid}`;
    return path.join(root, `run-${runId}`);
  }

  const isGitHubActions = (process.env.GITHUB_ACTIONS ?? "").toLowerCase() === "true";
  if (isGitHubActions && process.env.GITHUB_RUN_ID) {
    const id = sanitizeRunId(process.env.GITHUB_RUN_ID);
    const attempt = sanitizeRunId(process.env.GITHUB_RUN_ATTEMPT ?? "1");
    const job = sanitizeRunId(process.env.GITHUB_JOB ?? "job");
    const runId = [id, `a${attempt}`, job].filter(Boolean).join("-");
    return path.join(root, `run-${runId}`);
  }

  const ciJobId = sanitizeRunId(process.env.CI_JOB_ID ?? "");
  if (ciJobId) {
    return path.join(root, `run-${ciJobId}`);
  }

  const ciRunId = sanitizeRunId(process.env.CI_RUN_ID ?? "");
  if (ciRunId) {
    return path.join(root, `run-${ciRunId}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  const runId = sanitizeRunId(`${timestamp}-pid${process.pid}-${rand}`) || `${Date.now()}-${process.pid}`;
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

function teeChildOutput(child: ChildProcess, outputDir: string, basename: string): void;
function teeChildOutput(
  child: ChildProcess,
  outputDir: string,
  basename: string,
  mirrorToConsole: boolean,
): void;
function teeChildOutput(
  child: ChildProcess,
  outputDir: string,
  basename: string,
  mirrorToConsole = true,
) {
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
      if (mirrorToConsole) {
        process.stdout.write(chunk);
      }
    });
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      append(chunk);
      if (mirrorToConsole) {
        process.stderr.write(chunk);
      }
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
    cleanupChildProcess(windowsWebDriver);
    cleanupChildProcess(windowsApp);
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
  if (cachedTauriDriverBin && existsSync(cachedTauriDriverBin)) {
    return cachedTauriDriverBin;
  }

  const override = process.env.TAURI_DRIVER_PATH || process.env.TAURI_DRIVER_BIN;
  if (override && existsSync(override)) {
    cachedTauriDriverBin = override;
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
      cachedTauriDriverBin = resolved;
      return resolved;
    }
  }

  const cargoBin = path.resolve(os.homedir(), ".cargo", "bin", withPlatformExeSuffix("tauri-driver"));
  if (existsSync(cargoBin)) {
    cachedTauriDriverBin = cargoBin;
    return cargoBin;
  }

  const localRelease = path.resolve(
    projectRoot,
    "tools",
    "tauri-driver",
    "target",
    "release",
    withPlatformExeSuffix("tauri-driver"),
  );
  if (existsSync(localRelease)) {
    cachedTauriDriverBin = localRelease;
    return localRelease;
  }

  const localDebug = path.resolve(
    projectRoot,
    "tools",
    "tauri-driver",
    "target",
    "debug",
    withPlatformExeSuffix("tauri-driver"),
  );
  if (existsSync(localDebug)) {
    cachedTauriDriverBin = localDebug;
    return localDebug;
  }

  // Last resort: build the vendored tauri-driver (requires Rust toolchain).
  const toolsManifest = path.resolve(projectRoot, "tools", "tauri-driver", "Cargo.toml");
  if (existsSync(toolsManifest)) {
    const build = spawnSync(
      "cargo",
      ["build", "--manifest-path", toolsManifest, "--release"],
      { cwd: projectRoot, stdio: "inherit", shell: false },
    );
    if (build.status === 0 && existsSync(localRelease)) {
      cachedTauriDriverBin = localRelease;
      return localRelease;
    }
  }

  throw new Error(
    "Unable to locate tauri-driver. Set TAURI_DRIVER_PATH to override or build it via `cargo build --manifest-path tools/tauri-driver/Cargo.toml --release`.",
  );
}

function resolveWindowsWebview2UserDataFolder() {
  if (!isWindows) return undefined;

  // Make WebView2 storage deterministic across `browser.reloadSession()` calls. Otherwise the
  // native WebDriver will create a temporary user data folder and localStorage (i18n cache) can
  // appear to reset between sessions.
  //
  // EdgeDriver supports `ms:edgeOptions.webviewOptions.userDataFolder`.
  // See Microsoft docs: `webviewOptions.userDataFolder` creates/reuses the profile directory.
  const base = process.env.MODUDOC_E2E_RUN_DIR || process.env.MODUDOC_DATA_DIR || buildE2eDataDir();
  return path.join(base, "webview2-user-data");
}

export const config: Options.WebdriverIO = {
  runner: "local",
  hostname: "127.0.0.1",
  // NOTE: In Windows attach mode, we assign a per-worker port in onWorkerStart.
  port: tauriDriverPort,
  path: "/",
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
     process.env.MODUDOC_E2E_SKIP_REVEAL ||= "1";
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
  capabilities: windowsAttachEnabled
    ? [
        {
          maxInstances: 1,
          browserName: "webview2",
          "wdio:enforceWebDriverClassic": true,
          "ms:edgeOptions": {
            // Overridden in onWorkerStart; keep a placeholder for type shape.
            debuggerAddress: "127.0.0.1:0",
          },
        },
      ]
    : [
        {
          maxInstances: 1,
          browserName: process.platform === "win32" ? "webview2" : "wry",
          "wdio:enforceWebDriverClassic": true,
          "tauri:options": {
            application,
            webviewOptions: (() => {
              if (!isWindows) return {};

              const userDataFolder = resolveWindowsWebview2UserDataFolder();
              if (!userDataFolder) return {};
              try {
                mkdirSync(userDataFolder, { recursive: true });
              } catch {
                // ignore
              }
              return { userDataFolder };
            })(),
          },
        },
      ],
  onWorkerStart: (cid, caps, _specs, args) => {
    if (!windowsAttachEnabled) return;

    const { edgeDriverPort, webViewDebugPort } = resolveWindowsAttachWorkerPorts(cid);

    // Ensure each worker gets its own driver + WebView2 instance.
    (args as Record<string, unknown>).hostname = "127.0.0.1";
    (args as Record<string, unknown>).port = edgeDriverPort;
    (args as Record<string, unknown>).path = "/";

    const capsRecord = caps as Record<string, unknown>;
    const edgeOptionsRaw = capsRecord["ms:edgeOptions"];
    const edgeOptions =
      edgeOptionsRaw && typeof edgeOptionsRaw === "object"
        ? (edgeOptionsRaw as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    edgeOptions.debuggerAddress = `127.0.0.1:${webViewDebugPort}`;
    capsRecord["ms:edgeOptions"] = edgeOptions;
  },
  onPrepare: (_wdioConfig, capabilities) => {
    registerCleanupHandlers();
    // eslint-disable-next-line no-console
    console.log(
      `[MODUDOC_E2E] platform=${process.platform} mode=${e2eMode} windowsStrategy=${windowsDriverStrategy} CI=${JSON.stringify(
        process.env.CI,
      )}`,
    );
    try {
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
        const build = runTauriCli(["build", "--no-bundle"]);
        // eslint-disable-next-line no-console
        console.log(
          `[MODUDOC_E2E] tauri build exit=${build.status ?? "null"} error=${build.error ? String(build.error) : ""}`,
        );
        if (build.status !== 0) {
          throw new Error(`tauri build failed (exit=${build.status ?? "null"})`);
        }
      }

      const builtApp = findBuiltAppBinaryPath();
      process.env.MODUDOC_E2E_APP_PATH = builtApp;
      {
        const capsArray = Array.isArray(capabilities)
          ? capabilities
          : capabilities && typeof capabilities === "object"
            ? Object.values(capabilities as Record<string, unknown>)
            : [];
        for (const cap of capsArray) {
          if (cap && typeof cap === "object" && "tauri:options" in cap) {
            const opts = (cap as Record<string, unknown>)["tauri:options"];
            if (opts && typeof opts === "object") {
              (opts as Record<string, unknown>).application = builtApp;
            }
          }
        }
      }

      if (!existsSync(builtApp)) {
        throw new Error(`Built app binary not found at ${JSON.stringify(builtApp)}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[MODUDOC_E2E] onPrepare failed: ${
          err instanceof Error ? err.stack || err.message : String(err)
        }`,
      );
      throw err;
    }
  },
  beforeSession: (wdioConfig, caps) => {
    registerCleanupHandlers();

    if (!windowsAttachEnabled) {
      const msEdgeDriver = isWindows ? resolveMsEdgeDriverBin() : undefined;
      tauriDriver = spawn(
        resolveTauriDriverBin(),
        [
          "--port",
          String(tauriDriverPort),
          "--native-port",
          String(tauriNativePort),
          ...(msEdgeDriver ? ["--native-driver", msEdgeDriver] : []),
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
        },
      );
      if (process.env.MODUDOC_E2E_OUTPUT_DIR && tauriDriver) {
        teeChildOutput(tauriDriver, process.env.MODUDOC_E2E_OUTPUT_DIR, "tauri-driver.log");
      }

      // Wait for tauri-driver to accept connections before WDIO creates a session.
      waitForTcpPort("127.0.0.1", tauriDriverPort, 30000);
      try {
        const status = fetchWebDriverStatus("127.0.0.1", tauriDriverPort);
        // eslint-disable-next-line no-console
        console.log(`[tauri-driver] status: ${status}`);
      } catch {
        // ignore status failures (port open is usually sufficient)
      }
      return;
    }

    const builtApp = findBuiltAppBinaryPath();
    if (!existsSync(builtApp)) {
      throw new Error(`Built app binary not found at ${JSON.stringify(builtApp)}`);
    }

    const capsRecord = caps as Record<string, unknown>;
    const debugPort = parseDebuggerPort(
      (capsRecord["ms:edgeOptions"] as Record<string, unknown> | undefined)?.debuggerAddress,
    );
    if (!debugPort) {
      throw new Error("Windows attach mode requires ms:edgeOptions.debuggerAddress to be set");
    }

    const edgeDriverPort = wdioConfig.port;

    const baseDataDir = process.env.MODUDOC_E2E_RUN_DIR || buildE2eDataDir();
    const workerDataDir = path.join(baseDataDir, `worker-${edgeDriverPort}`);
    try {
      rmSync(workerDataDir, { recursive: true, force: true });
    } catch {
      // ignore stale directory cleanup failures
    }
    mkdirSync(workerDataDir, { recursive: true });

    // eslint-disable-next-line no-console
    console.log(
      `[MODUDOC_E2E] worker=${process.env.WDIO_WORKER_ID ?? ""} edgeDriverPort=${edgeDriverPort} webviewDebugPort=${debugPort} app=${builtApp} dataDir=${workerDataDir}`,
    );

    const webviewArgs = `--remote-debugging-port=${debugPort} --remote-allow-origins=*`;
    windowsApp = spawn(builtApp, [], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: webviewArgs,
        MODUDOC_DATA_DIR: workerDataDir,
      } as NodeJS.ProcessEnv,
    });
    if (process.env.MODUDOC_E2E_OUTPUT_DIR && windowsApp) {
      teeChildOutput(
        windowsApp,
        process.env.MODUDOC_E2E_OUTPUT_DIR,
        `modudoc-${edgeDriverPort}.log`,
      );
    }

    waitForTcpPort("127.0.0.1", debugPort, 60000);

    const msEdgeDriver = resolveMsEdgeDriverBin();
    windowsWebDriver = spawn(
      msEdgeDriver,
      ["--verbose", `--port=${edgeDriverPort}`, "--host=127.0.0.1"],
      {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      },
    );
    if (process.env.MODUDOC_E2E_OUTPUT_DIR && windowsWebDriver) {
      teeChildOutput(
        windowsWebDriver,
        process.env.MODUDOC_E2E_OUTPUT_DIR,
        `msedgedriver-${edgeDriverPort}.log`,
        // msedgedriver --verbose spams DevTools DEBUG lines and can make GitHub Actions UI
        // appear blank due to extremely large logs. Keep the file for postmortem, but don't
        // mirror to the step log.
        false,
      );
    }

    waitForTcpPort("127.0.0.1", edgeDriverPort, 30000);
    const status = fetchWebDriverStatus("127.0.0.1", edgeDriverPort);
    // eslint-disable-next-line no-console
    console.log(`[msedgedriver] status: ${status}`);
  },
  before: async () => {
    const width = resolveNumberEnv("MODUDOC_E2E_WINDOW_WIDTH") ?? 1280;
    const height = resolveNumberEnv("MODUDOC_E2E_WINDOW_HEIGHT") ?? 900;

    // Resizing the window via WebDriver can leave unpainted/blank regions in WebView2 when
    // using the tauri-driver strategy on Windows. The app already boots with a stable size
    // from `src-tauri/tauri.conf.json`, so skip programmatic resizing by default.
    if (process.platform === "win32" && windowsDriverStrategy === "tauri-driver") {
      return;
    }

    try {
      await browser.setWindowSize(width, height);
      return;
    } catch {
      // ignore
    }

    try {
      await browser.setWindowRect(0, 0, width, height);
      return;
    } catch {
      // ignore
    }

    try {
      await browser.maximizeWindow();
    } catch {
      // ignore
    }
  },
  afterSession: () => {
    cleanupChildProcess(tauriDriver);
    tauriDriver = undefined;
    cleanupChildProcess(viteServer);
    viteServer = undefined;
    cleanupChildProcess(windowsWebDriver);
    windowsWebDriver = undefined;
    cleanupChildProcess(windowsApp);
    windowsApp = undefined;
  },
  onComplete: () => {
    cleanupChildProcess(tauriDriver);
    tauriDriver = undefined;
    cleanupChildProcess(viteServer);
    viteServer = undefined;
  },
};

export default config;
