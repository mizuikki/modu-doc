import path from "node:path";

export function normalizeExpectedTargetPath(targetPath: string) {
  const normalized = path.normalize(path.resolve(targetPath));
  if (process.platform === "win32") {
    return normalized.replaceAll("/", "\\").toLowerCase();
  }
  return normalized;
}
