import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, "THIRD_PARTY_NOTICES.txt");
const mode = process.argv.includes("--write") ? "write" : "check";

function licenseFromManifest(manifest) {
  if (typeof manifest.license === "string" && manifest.license.trim()) {
    return manifest.license.trim();
  }
  if (manifest.license && typeof manifest.license === "object") {
    if (typeof manifest.license.type === "string" && manifest.license.type.trim()) {
      return manifest.license.type.trim();
    }
  }
  if (Array.isArray(manifest.licenses) && manifest.licenses.length > 0) {
    const values = manifest.licenses
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry.type === "string") return entry.type.trim();
        return "";
      })
      .filter(Boolean);
    if (values.length > 0) {
      return values.join(" OR ");
    }
  }
  return "unknown";
}

function formatSection(title, entries) {
  if (entries.length === 0) {
    return [`## ${title}`, "", "_No direct dependencies discovered._", ""].join("\n");
  }
  return [`## ${title}`, "", ...entries.map((entry) => `- ${entry}`), ""].join("\n");
}

function nodePackageLicense(packageName) {
  const manifestPath = path.join(
    rootDir,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );
  if (!existsSync(manifestPath)) {
    return "unknown";
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return licenseFromManifest(manifest);
}

function cargoDirectDependencies() {
  const metadata = JSON.parse(
    execFileSync(
      "cargo",
      [
        "metadata",
        "--format-version",
        "1",
        "--manifest-path",
        path.join(rootDir, "src-tauri", "Cargo.toml"),
      ],
      {
        cwd: rootDir,
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
      },
    ),
  );
  const rootPackage = metadata.packages.find((pkg) =>
    pkg.manifest_path.replace(/\\/g, "/").endsWith("/src-tauri/Cargo.toml"),
  );
  if (!rootPackage) {
    return { runtime: [], build: [] };
  }
  const uniqueNames = new Set();
  const runtime = [];
  const build = [];
  for (const dependency of rootPackage.dependencies) {
    if (uniqueNames.has(`${dependency.name}:${dependency.kind ?? "runtime"}`)) {
      continue;
    }
    uniqueNames.add(`${dependency.name}:${dependency.kind ?? "runtime"}`);
    const packageInfo =
      metadata.packages.find(
        (pkg) =>
          pkg.name === dependency.name &&
          pkg.source &&
          pkg.manifest_path !== rootPackage.manifest_path,
      ) ?? null;
    const license = packageInfo ? licenseFromManifest(packageInfo) : "unknown";
    const entry = `${dependency.name}${dependency.req ? ` ${dependency.req}` : ""} (${license})`;
    if (dependency.kind === "build") {
      build.push(entry);
    } else {
      runtime.push(entry);
    }
  }
  runtime.sort((left, right) => left.localeCompare(right));
  build.sort((left, right) => left.localeCompare(right));
  return { runtime, build };
}

function nodeDirectDependencies() {
  const manifest = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const runtime = Object.keys(manifest.dependencies ?? {})
    .sort()
    .map((name) => {
      const version = manifest.dependencies[name];
      return `${name} ${version} (${nodePackageLicense(name)})`;
    });
  const dev = Object.keys(manifest.devDependencies ?? {})
    .sort()
    .map((name) => {
      const version = manifest.devDependencies[name];
      return `${name} ${version} (${nodePackageLicense(name)})`;
    });
  return { runtime, dev };
}

function buildNotice() {
  const nodeDeps = nodeDirectDependencies();
  const cargoDeps = cargoDirectDependencies();
  return [
    "# Third-Party Notices",
    "",
    "This file is generated from `package.json` and `src-tauri/Cargo.toml`.",
    "Run `npm run notice:write` after dependency changes.",
    "",
    formatSection("Frontend runtime dependencies", nodeDeps.runtime),
    formatSection("Frontend development dependencies", nodeDeps.dev),
    formatSection("Rust runtime dependencies", cargoDeps.runtime),
    formatSection("Rust build dependencies", cargoDeps.build),
  ].join("\n");
}

const nextContent = `${buildNotice().trimEnd()}\n`;

if (mode === "write") {
  await writeFile(outputPath, nextContent, "utf8");
} else {
  const current = existsSync(outputPath) ? await readFile(outputPath, "utf8") : "";
  if (current !== nextContent) {
    process.stderr.write(`THIRD_PARTY_NOTICES.txt is stale. Run \`npm run notice:write\`.\n`);
    process.exit(1);
  }
}
