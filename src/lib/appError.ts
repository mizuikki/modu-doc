export function normalizeAppError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message || "unknown";
  }
  if (error && typeof error === "object") {
    const candidate = (
      error as {
        message?: unknown;
        payload?: unknown;
        error?: unknown;
      }
    ).message;
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
    const payload = (error as { payload?: unknown }).payload;
    if (typeof payload === "string" && payload) {
      return payload;
    }
    const nestedError = (error as { error?: unknown }).error;
    if (typeof nestedError === "string" && nestedError) {
      return nestedError;
    }
  }
  return "unknown";
}
