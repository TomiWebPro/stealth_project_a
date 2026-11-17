import { describe, expect, it } from "vitest";
import { formatProjectUpdatedAt, formatProjectUpdatedAtLong } from "./helpers";

describe("project display helpers", () => {
  it("passes invalid or empty timestamps through unchanged (error/empty-safe)", () => {
    expect(formatProjectUpdatedAt("not-a-date")).toBe("not-a-date");
    expect(formatProjectUpdatedAtLong("")).toBe("");
  });

  it("formats valid timestamps for list and detail views", () => {
    const iso = "2026-11-17T10:30:00Z";
    expect(formatProjectUpdatedAt(iso)).toBe(new Date(iso).toLocaleDateString());
    expect(formatProjectUpdatedAtLong(iso)).toBe(new Date(iso).toLocaleString());
  });
});
