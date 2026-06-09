import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const previewHost = "127.0.0.1";
const outputRoot = path.join(repoRoot, "tmp", "ui-snapshots", "modudoc");
const viewport = { width: 1280, height: 860 };

let shotLimit = null;
let keepRuns = 3;

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === "--limit") {
    const rawLimit = process.argv[index + 1];
    const nextLimit = Number.parseInt(rawLimit ?? "", 10);
    if (!Number.isInteger(nextLimit) || nextLimit <= 0) {
      throw new Error(`Invalid --limit value: ${rawLimit ?? ""}`);
    }
    shotLimit = nextLimit;
    index += 1;
    continue;
  }

  if (arg === "--keep") {
    const rawKeep = process.argv[index + 1];
    const nextKeep = Number.parseInt(rawKeep ?? "", 10);
    if (!Number.isInteger(nextKeep) || nextKeep <= 0) {
      throw new Error(`Invalid --keep value: ${rawKeep ?? ""}`);
    }
    keepRuns = nextKeep;
    index += 1;
  }
}

const shots = [
  {
    name: "document-default",
    scenario: "default",
    waitFor: "[data-testid='document-header']",
  },
  {
    name: "document-ready",
    scenario: "workspace-ready",
    waitFor: "[data-testid='document-header']",
  },
  {
    name: "document-preview",
    scenario: "preview",
    waitFor: ".preview-pane",
  },
  {
    name: "document-history",
    scenario: "history",
    waitFor: ".history-view",
  },
  {
    name: "library-insert",
    scenario: "library-insert",
    waitFor: ".right-panel",
  },
];

function spawnCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

function localTimestamp(mode = "json") {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const timeSeparator = mode === "dir" ? "-" : ":";
  const offsetSeparator = mode === "dir" ? "-" : ":";

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}${timeSeparator}${pad(now.getMinutes())}${timeSeparator}${pad(now.getSeconds())}` +
    `${sign}${pad(Math.floor(absoluteOffsetMinutes / 60))}${offsetSeparator}${pad(absoluteOffsetMinutes % 60)}`
  );
}

function waitForPort(port, host) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 120000;
    const attempt = () => {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };
    attempt();
  });
}

async function findFreePort(host) {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to resolve free port")));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function configurePlaywrightBrowserEnv() {
  const archSuffix = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : "";
  if (!archSuffix) {
    return;
  }

  process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(repoRoot, ".cache/ms-playwright");

  try {
    const raw = readFileSync("/etc/os-release", "utf8");
    const idMatch = raw.match(/^ID=(.+)$/m);
    const versionMatch = raw.match(/^VERSION_ID=(.+)$/m);
    const osId = idMatch ? idMatch[1].replace(/^"|"$/g, "") : "";
    const versionId = versionMatch ? versionMatch[1].replace(/^"|"$/g, "") : "";
    const major = Number.parseInt(versionId.split(".")[0] || "", 10);

    if (osId === "ubuntu" && Number.isFinite(major) && major >= 26) {
      process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = `ubuntu24.04-${archSuffix}`;
    }
  } catch {
    // Keep defaults when host OS metadata is unavailable.
  }
}

async function installChromium() {
  await spawnCommand("npm", ["exec", "--", "playwright", "install", "chromium"]);
}

function resolveSystemChromiumExecutable() {
  const candidates = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function pruneOldRuns(baseDir, keep, currentRunDir) {
  if (!Number.isInteger(keep) || keep <= 0 || !existsSync(baseDir)) {
    return;
  }

  const entries = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      entries.push(path.join(baseDir, entry.name));
    }
  }

  entries.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  let retained = 0;
  for (const entry of entries) {
    if (entry === currentRunDir || retained < keep) {
      retained += 1;
      continue;
    }
    rmSync(entry, { recursive: true, force: true });
  }
}

async function launchChromium() {
  const executablePath = resolveSystemChromiumExecutable();
  if (executablePath) {
    return await chromium.launch({
      headless: true,
      executablePath,
    });
  }

  try {
    return await chromium.launch({ headless: true });
  } catch {
    await installChromium();
    return await chromium.launch({ headless: true });
  }
}

async function waitForScreenshotReady(page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.screenshotReady === "true",
    undefined,
    { timeout: 15000 },
  );
}

async function main() {
  configurePlaywrightBrowserEnv();
  await mkdir(outputRoot, { recursive: true });
  const runDir = path.join(outputRoot, localTimestamp("dir"));
  await rm(runDir, { recursive: true, force: true });
  await mkdir(path.join(runDir, "shots"), { recursive: true });

  await spawnCommand("npm", ["run", "build"]);

  const previewPort = await findFreePort(previewHost);
  const previewBaseUrl = `http://${previewHost}:${previewPort}`;
  const preview = spawn(
    "npm",
    [
      "exec",
      "--",
      "vite",
      "preview",
      "--host",
      previewHost,
      "--port",
      String(previewPort),
      "--strictPort",
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  try {
    await waitForPort(previewPort, previewHost);

    const browser = await launchChromium();
    try {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
      });
      const selectedShots = shotLimit ? shots.slice(0, shotLimit) : shots;
      const manifest = [];

      for (const shot of selectedShots) {
        const page = await context.newPage();
        const url = `${previewBaseUrl}/?screenshot=${encodeURIComponent(shot.scenario)}`;

        await page.goto(url, { waitUntil: "domcontentloaded" });
        await waitForScreenshotReady(page);
        await page.waitForSelector(shot.waitFor, { state: "visible", timeout: 5000 });
        await page.waitForTimeout(200);

        const filePath = path.join(runDir, "shots", `${shot.name}.png`);
        await page.screenshot({ path: filePath, fullPage: false });

        manifest.push({
          name: shot.name,
          scenario: shot.scenario,
          url,
          file: path.relative(runDir, filePath),
        });
        await page.close();
      }

      await writeFile(
        path.join(runDir, "manifest.json"),
        `${JSON.stringify(
          {
            generatedAt: localTimestamp("json"),
            limit: shotLimit,
            viewport,
            shots: manifest,
          },
          null,
          2,
        )}\n`,
      );

      pruneOldRuns(outputRoot, keepRuns, runDir);
      console.log(`Screenshot output: ${path.relative(repoRoot, runDir)}`);
    } finally {
      await browser.close();
    }
  } finally {
    const exited = new Promise((resolve) => {
      preview.once("exit", () => resolve());
    });
    preview.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
}

await main();
