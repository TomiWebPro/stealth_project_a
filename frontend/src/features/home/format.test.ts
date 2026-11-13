import { describe, expect, it } from "vitest";

import { formatRelative } from "./format";

// Fixed clock so assertions are deterministic across runs.
const NOW = Date.parse("2026-01-10T12:00:00Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe("formatRelative", () => {
  it("describes past timestamps as 'ago'", () => {
    expect(formatRelative(minutesAgo(5), NOW)).toBe("5 minutes ago");
    expect(formatRelative(minutesAgo(120), NOW)).toBe("2 hours ago");
    expect(formatRelative(minutesAgo(60 * 24 * 3), NOW)).toBe("3 days ago");
  });

  it("describes future timestamps as 'in …' with the correct magnitude", () => {
    // A job scheduled slightly ahead should read forward, not "0 seconds ago".
    expect(formatRelative(minutesAgo(-5), NOW)).toBe("in 5 minutes");
    expect(formatRelative(minutesAgo(-120), NOW)).toBe("in 2 hours");
  });

  it("renders a timestamp within the same second as 'now'", () => {
    expect(formatRelative(new Date(NOW).toISOString(), NOW)).toBe("now");
  });

  it("falls back to an absolute date beyond the largest relative unit", () => {
    const ancient = new Date(Date.parse("2019-03-04T00:00:00Z")).toISOString();
    // No "week/month/year" units are defined, so older dates format as a date.
    expect(formatRelative(ancient, NOW)).toMatch(/2019/);
  });

  it("returns the input unchanged when it is not a valid timestamp", () => {
    expect(formatRelative("not-a-date", NOW)).toBe("not-a-date");
  });
});
