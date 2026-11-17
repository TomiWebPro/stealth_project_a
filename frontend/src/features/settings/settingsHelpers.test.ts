import { describe, expect, it } from "vitest";
import type { Provider } from "../../lib/types";
import {
  connectionRows,
  connectionSummary,
  testResultMessage,
  validateBaseUrl,
} from "./settingsHelpers";

function provider(id: string, status: Provider["status"]): Provider {
  return {
    id,
    project_id: "project-1",
    name: `Provider ${id}`,
    location: "local",
    status,
    capabilities: [],
  } as Provider;
}

describe("settings helpers", () => {
  it("validates absolute http(s) base URLs", () => {
    expect(validateBaseUrl("http://localhost:8000/api/v1")).toBeNull();
    expect(validateBaseUrl("https://example.com/api")).toBeNull();
    expect(validateBaseUrl("")).toContain("required");
    expect(validateBaseUrl("not a url")).toContain("valid absolute URL");
    expect(validateBaseUrl("ftp://example.com")).toContain("http or https");
  });

  it("derives connection rows, defaulting enabled from availability", () => {
    const rows = connectionRows(
      [provider("a", "available"), provider("b", "degraded"), provider("c", "unavailable")],
      { c: true, b: false },
    );
    expect(rows.map((row) => row.enabled)).toEqual([true, false, true]);
    expect(connectionSummary(rows)).toBe("2 of 3 providers enabled");
    expect(connectionSummary([])).toBe("No providers registered");
  });

  it("renders test result messages", () => {
    expect(testResultMessage({ kind: "idle" })).toContain("No connection test");
    expect(testResultMessage({ kind: "testing" })).toContain("Testing");
    expect(testResultMessage({ kind: "success", count: 2 })).toContain("2 providers");
    expect(testResultMessage({ kind: "error", message: "boom" })).toContain("boom");
  });
});
