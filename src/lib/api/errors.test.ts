import { describe, expect, it } from "vitest";
import { normalizeApiErrorCode } from "./errors";

describe("api/errors", () => {
  it("normalizes known string codes", () => {
    expect(normalizeApiErrorCode("external_conflict")).toBe("external_conflict");
    expect(normalizeApiErrorCode("target_not_writable")).toBe("target_not_writable");
  });

  it("normalizes Error instances", () => {
    expect(normalizeApiErrorCode(new Error("database_error"))).toBe("database_error");
    expect(normalizeApiErrorCode(new Error("not_a_code"))).toBe("unknown");
  });

  it("normalizes nested payload shapes", () => {
    expect(normalizeApiErrorCode({ payload: "invalid_target_path" })).toBe("invalid_target_path");
    expect(normalizeApiErrorCode({ message: "project_not_found" })).toBe("project_not_found");
  });
});
