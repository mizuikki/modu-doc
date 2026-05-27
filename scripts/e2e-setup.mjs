import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[e2e:setup] ${message}`);
}

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`[e2e:setup] ${message}`);
  process.exit(1);
}

const projectRoot = process.cwd();
const isWindows = process.platform === "win32";

log(`platform=${process.platform} node=${process.version}`);

const e2eRoot = process.env.MODUDOC_E2E_ROOT || path.join(projectRoot, "tmp", "modudoc-e2e");
const driverCacheDir = path.join(e2eRoot, "drivers");
try {
  fs.mkdirSync(driverCacheDir, { recursive: true });
} catch {
  // ignore
}

if (isWindows) {
  // 1) Ensure tauri-driver exists (vendored under tools/tauri-driver).
  const tauriDriverBin = path.join(
    projectRoot,
    "tools",
    "tauri-driver",
    "target",
    "release",
    "tauri-driver.exe",
  );

  if (!fs.existsSync(tauriDriverBin)) {
    const manifest = path.join(projectRoot, "tools", "tauri-driver", "Cargo.toml");
    if (!fs.existsSync(manifest)) {
      fail(`Missing vendored tauri-driver manifest at ${manifest}`);
    }

    log("Building tauri-driver (tools/tauri-driver)...");
    const build = spawnSync("cargo", ["build", "--manifest-path", manifest, "--release"], {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
    });
    if (build.status !== 0) {
      fail(`Failed to build tauri-driver (exit=${build.status ?? "null"})`);
    }
  }
  log(`tauri-driver: ${tauriDriverBin}`);

  // 2) Ensure msedgedriver exists (download via the lockfile-pinned `edgedriver` package).
  log(`Downloading msedgedriver into cache dir: ${driverCacheDir}`);
  const download = spawnSync(
    process.execPath,
    [
      "-e",
      `import('edgedriver').then(m=>m.download(undefined,${JSON.stringify(
        driverCacheDir,
      )}).then(p=>{console.log(String(p||''))}).catch(e=>{console.error(e?.stack||String(e));process.exit(1);})).catch(e=>{console.error(e?.stack||String(e));process.exit(1);});`,
    ],
    { cwd: projectRoot, stdio: "inherit", shell: false },
  );
  if (download.status !== 0) {
    fail(`Failed to download msedgedriver (exit=${download.status ?? "null"})`);
  }
  log("msedgedriver: downloaded");
} else {
  // Non-Windows environments generally rely on system-provided WebDriver binaries + tauri-driver in PATH.
  const cargoBin = path.join(os.homedir(), ".cargo", "bin", "tauri-driver");
  log("Non-Windows platform detected.");
  log("Ensure `tauri-driver` is available (e.g. in PATH) and native WebDriver dependencies are installed.");
  log(`Hint: typical cargo bin path is ${cargoBin}`);
}

log("Done.");

