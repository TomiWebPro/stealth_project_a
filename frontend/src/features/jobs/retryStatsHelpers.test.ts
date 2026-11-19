import { describe, expect, it } from "vitest";
import type { RetryStats } from "../../lib/types";
import {
  hasRetryStatsData,
  newestRetryLabel,
  retryProjectLabel,
  retryProjectRows,
  retryRelativeLabel,
  retryStatsCards,
  retryStatsGeneratedAtLabel,
  retryStatusCount,
  retryStatusLabel,
  retryStatusRows,
  validRetryStatusCount,
} from "./retryStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: RetryStats = {
  total_retries: 12,
  total_jobs: 4,
  by_status: [
    { status: "queued", jobs: 1 },
    { status: "running", jobs: 0 },
    { status: "succeeded", jobs: 1 },
    { status: "failed", jobs: 2 },
    { status: "canceled", jobs: 0 },
  ],
  by_project: [
    { project_id: "proj-bbbb-1111", retries: 2, jobs: 1 },
    { project_id: "proj-aaaa-2222", retries: 7, jobs: 2 },
    { project_id: "proj-cccc-3333", retries: 3, jobs: 1 },
  ],
  newest_retry_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: RetryStats = {
  total_retries: 0,
  total_jobs: 0,
  by_status: [
    { status: "queued", jobs: 0 },
    { status: "running", jobs: 0 },
    { status: "succeeded", jobs: 0 },
    { status: "failed", jobs: 0 },
    { status: "canceled", jobs: 0 },
  ],
  by_project: [],
  newest_retry_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("retry stats formatters", () => {
  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(retryRelativeLabel(null)).toBe("");
    expect(retryRelativeLabel(undefined)).toBe("");
    expect(retryRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(retryRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-retry label from the snapshot", () => {
    expect(newestRetryLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestRetryLabel(empty, NOW)).toBe("");
    expect(newestRetryLabel(undefined, NOW)).toBe("");
  });

  it("maps canonical job statuses to human labels", () => {
    expect(retryStatusLabel("queued")).toBe("Queued");
    expect(retryStatusLabel("running")).toBe("Running");
    expect(retryStatusLabel("succeeded")).toBe("Succeeded");
    expect(retryStatusLabel("failed")).toBe("Failed");
    expect(retryStatusLabel("canceled")).toBe("Canceled");
  });

  it("shortens long project ids and handles empty ids for compact rows", () => {
    expect(retryProjectLabel("proj-aaaa-2222")).toBe("proj-aaa…");
    expect(retryProjectLabel("abc")).toBe("abc");
    expect(retryProjectLabel("")).toBe("Unknown");
  });

  it("counts retried jobs in one status and tolerates malformed buckets", () => {
    expect(retryStatusCount(populated, "failed")).toBe(2);
    expect(retryStatusCount(populated, "running")).toBe(0);
    expect(
      retryStatusCount({ ...populated, by_status: [{ status: "failed", jobs: Number.NaN }] }, "failed"),
    ).toBe(0);
    expect(retryStatusCount(undefined)).toBe(0);
  });
});

describe("retryStatsCards", () => {
  it("derives totals, failed share and recency signals in a stable order", () => {
    const cards = retryStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual(["retries", "jobs", "failed", "newest"]);
    expect(cards.map((card) => card.value)).toEqual([
      "12",
      "4",
      "50%",
      "15 minutes ago",
    ]);
    expect(cards[2]?.hint).toBe("2 retried jobs failed");
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(retryStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0%",
      "—",
    ]);
    expect(retryStatsCards(empty, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0%",
      "—",
    ]);
  });
});

describe("retryStatusRows", () => {
  it("returns a complete zero-filled five-status breakdown with shares and tones", () => {
    const rows = retryStatusRows(populated);
    expect(rows.map((row) => row.status)).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "canceled",
    ]);
    expect(rows[0]).toMatchObject({
      label: "Queued",
      jobs: 1,
      percent: 25,
      tone: "neutral",
    });
    expect(rows[3]).toMatchObject({ label: "Failed", jobs: 2, percent: 50, tone: "danger" });
    expect(rows[4]).toMatchObject({ label: "Canceled", jobs: 0, percent: 0, fraction: 0 });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = retryStatusRows({
      ...populated,
      by_status: [
        { status: "failed", jobs: Number.NaN },
        { status: "queued", jobs: 4 },
      ],
    });
    expect(rows[3]?.jobs).toBe(0);
    expect(rows[0]?.percent).toBe(100);
    expect(retryStatusRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(retryStatusRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("retryProjectRows", () => {
  it("orders projects by descending retry count then id with shares", () => {
    const rows = retryProjectRows(populated);
    expect(rows.map((row) => row.projectId)).toEqual([
      "proj-aaaa-2222",
      "proj-cccc-3333",
      "proj-bbbb-1111",
    ]);
    expect(rows[0]).toMatchObject({
      label: "proj-aaa…",
      retries: 7,
      jobs: 2,
      percent: 58,
    });
  });

  it("returns no rows for absent or empty snapshots and tolerates malformed entries", () => {
    expect(retryProjectRows(undefined)).toEqual([]);
    expect(retryProjectRows(empty)).toEqual([]);
    expect(
      retryProjectRows({
        ...populated,
        by_project: [{ project_id: "p1", retries: Number.NaN, jobs: 1 }],
      }),
    ).toEqual([]);
  });
});

describe("hasRetryStatsData and validRetryStatusCount", () => {
  it("detects empty snapshots from the authoritative retry total", () => {
    expect(hasRetryStatsData(populated)).toBe(true);
    expect(hasRetryStatsData(empty)).toBe(false);
    expect(hasRetryStatsData(undefined)).toBe(false);
    expect(hasRetryStatsData({ ...empty, total_retries: 3 })).toBe(true);
  });

  it("counts only well-formed retry-status buckets", () => {
    expect(validRetryStatusCount(populated)).toBe(5);
    expect(validRetryStatusCount(empty)).toBe(5);
    expect(
      validRetryStatusCount({ ...populated, by_status: [{ status: "failed", jobs: Number.NaN }] }),
    ).toBe(0);
    expect(validRetryStatusCount(undefined)).toBe(0);
  });
});

describe("retryStatsGeneratedAtLabel", () => {
  it("derives a generated-at footer label", () => {
    expect(retryStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(retryStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
