import { execFileSync, spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "tmp", "tauri-screenshots");
const vitePort = 4174;
const baseDevUrl = `http://127.0.0.1:${vitePort}`;
const tauriWindow = {
  width: 1280,
  height: 860,
  minWidth: 1024,
};

const scenarios = [
  { id: "edit-fragment", file: "tauri-edit-fragment.png" },
  { id: "library-insert", file: "tauri-library-insert.png" },
  { id: "preview", file: "tauri-preview-tab.png" },
  { id: "history", file: "tauri-history-tab.png" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

async function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Dev server still starting.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForProcessExit(child, timeoutMs = 10000) {
  return await Promise.race([
    new Promise((resolve) => {
      child.once("exit", () => resolve(true));
    }),
    sleep(timeoutMs).then(() => false),
  ]);
}

async function killProcessGroup(child) {
  if (!child.pid) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }
  const exited = await waitForProcessExit(child);
  if (!exited) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // Ignore if already exited.
    }
  }
}

function createCaptureServer() {
  const readyPayloads = new Map();
  const waiters = new Map();

  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.method !== "POST" || request.url !== "/ready") {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const scenarioId = payload?.scenarioId;
        if (!scenarioId) {
          response.statusCode = 400;
          response.end("Missing scenarioId");
          return;
        }

        const waiter = waiters.get(scenarioId);
        if (waiter) {
          clearTimeout(waiter.timeoutId);
          waiters.delete(scenarioId);
          waiter.resolve(payload);
        } else {
          readyPayloads.set(scenarioId, payload);
        }
        response.end("ok");
      } catch (error) {
        response.statusCode = 400;
        response.end(error instanceof Error ? error.message : "Invalid payload");
      }
    });
  });

  async function listen() {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine capture server port");
    }
    return address.port;
  }

  function waitForScenario(scenarioId, timeoutMs = 30000) {
    const existing = readyPayloads.get(scenarioId);
    if (existing) {
      readyPayloads.delete(scenarioId);
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        waiters.delete(scenarioId);
        reject(new Error(`Timed out waiting for screenshot readiness: ${scenarioId}`));
      }, timeoutMs);
      waiters.set(scenarioId, { resolve, timeoutId });
    });
  }

  async function close() {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  return { listen, waitForScenario, close };
}

function buildCsp(capturePort) {
  return [
    "default-src 'self' ipc: http://ipc.localhost;",
    "script-src 'self';",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' asset: http://asset.localhost blob: data:;",
    [
      "connect-src 'self' ipc: http://ipc.localhost",
      "http://localhost:5173 ws://localhost:5173",
      `http://127.0.0.1:${vitePort} ws://127.0.0.1:${vitePort}`,
      `http://localhost:${vitePort} ws://localhost:${vitePort}`,
      `http://127.0.0.1:${capturePort}`,
    ].join(" "),
  ].join(" ");
}

async function createTauriConfig(tmpDir, scenarioId, title, capturePort) {
  const configPath = path.join(tmpDir, `tauri.capture.${scenarioId}.json`);
  const config = {
    build: {
      beforeDevCommand: "",
      devUrl: `${baseDevUrl}/?screenshot=${scenarioId}&capturePort=${capturePort}`,
    },
    app: {
      windows: [
        {
          title,
          width: tauriWindow.width,
          height: tauriWindow.height,
          minWidth: tauriWindow.minWidth,
        },
      ],
      security: {
        csp: buildCsp(capturePort),
      },
    },
  };
  await writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

function captureActiveWindow(targetPath) {
  runCommand("spectacle", ["-b", "-a", "-e", "-S", "-n", "-o", targetPath]);
}

function identifyDimensions(targetPath) {
  const [width, height] = runCommand("identify", ["-format", "%w %h", targetPath])
    .split(" ")
    .map((value) => Number.parseInt(value, 10));
  return { width, height };
}

function looksLikeTauriWindowCapture(size) {
  return size.width <= 2000 && size.height <= 1300;
}

async function captureValidatedWindow(targetPath, scenarioId) {
  let lastSize = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await sleep(300 * attempt);
    }

    captureActiveWindow(targetPath);
    const size = identifyDimensions(targetPath);
    lastSize = size;

    if (looksLikeTauriWindowCapture(size)) {
      return size;
    }
  }

  throw new Error(
    `Captured the wrong active window for ${scenarioId}; last size was ${lastSize?.width}x${lastSize?.height}`,
  );
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-tauri-capture-"));
  const captureServer = createCaptureServer();
  const capturePort = await captureServer.listen();

  const devServer = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );

  devServer.stdout.on("data", () => {});
  devServer.stderr.on("data", () => {});

  const generated = [];

  try {
    await waitForUrl(baseDevUrl);

    for (const scenario of scenarios) {
      const title = `ModuDoc Capture ${scenario.id}`;
      const configPath = await createTauriConfig(tempDir, scenario.id, title, capturePort);
      const tauriProcess = spawn(
        "npx",
        ["tauri", "dev", "--no-dev-server-wait", "--config", configPath],
        {
          cwd: repoRoot,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            WEBKIT_DISABLE_DMABUF_RENDERER: "1",
          },
        },
      );

      tauriProcess.stdout.on("data", () => {});
      tauriProcess.stderr.on("data", () => {});

      const framePath = path.join(tempDir, `${scenario.id}.active-window.png`);
      try {
        const payload = await captureServer.waitForScenario(scenario.id);
        const targetPath = path.join(outputDir, scenario.file);
        await sleep(1200);
        const sourceSize = await captureValidatedWindow(framePath, scenario.id);
        await copyFile(framePath, targetPath);

        generated.push({
          scenarioId: scenario.id,
          file: path.relative(repoRoot, targetPath),
          sourceSize,
          payload,
        });
      } finally {
        await killProcessGroup(tauriProcess);
        await rm(framePath, { force: true });
      }
    }

    const manifestPath = path.join(outputDir, "manifest.json");
    const manifest = {
      generatedAt: new Date().toISOString(),
      window: tauriWindow,
      mode: "real-tauri-dev-wayland-fullscreen-crop",
      capturePort,
      files: generated,
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ outputDir, manifestPath, files: generated }, null, 2));
  } finally {
    await killProcessGroup(devServer);
    await captureServer.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
