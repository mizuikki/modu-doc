import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export function normalizeExpectedTargetPath(targetPath: string) {
  const resolved = path.resolve(targetPath);
  const normalized = existsSync(resolved)
    ? realpathSync.native(resolved)
    : path.join(realpathSync.native(path.dirname(resolved)), path.basename(resolved));
  if (process.platform === "win32") {
    return normalized.replaceAll("/", "\\").toLowerCase();
  }
  return normalized;
}
