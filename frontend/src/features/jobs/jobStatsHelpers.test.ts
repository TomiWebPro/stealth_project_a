import { describe, expect, it } from "vitest";
import type { JobStats } from "../../lib/types";
import {
  formatDurationSeconds,
  formatSuccessRate,
  hasJobStatsData,
  humanizeOperationId,
  jobOperationRows,
  jobStatsCards,
  jobStatsGeneratedAtLabel,
  jobStatusRows,
} from "./jobStatsHelpers";

const populated: JobStats = {
  total: 8,
  by_status: [
    { status: "queued", count: 1 },
    { status: "running", count: 2 },
    { status: "succeeded", count: 3 },
    { status: "failed", count: 1 },
    { status: "canceled", count: 1 },
  ],
  by_operation: [
    { operation_id: "lora-train", total: 4, succeeded: 3, failed: 1 },
    { operation_id: "dataset-prep", total: 2, succeeded: 2, failed: 0 },
    { operation_id: "image-to-video", total: 2, succeeded: 0, failed: 2 },
  ],
  success_rate: 0.75,
  in_flight: 3,
  completed: 5,
  average_duration_seconds: 83.4,
  generated_at: "2026-01-01T00:00:00Z",
};

const empty: JobStats = {
  total: 0,
  by_status: [],
  by_operation: [],
  success_rate: 0,
  in_flight: 0,
  completed: 0,
  average_duration_seconds: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("job stats formatters", () => {
  it("formats success ratios and durations with safe fallbacks", () => {
    expect(formatSuccessRate(0.755)).toBe("76%");
    expect(formatSuccessRate(0)).toBe("0%");
    expect(formatSuccessRate(undefined)).toBe("—");
    expect(formatSuccessRate(null)).toBe("—");
    expect(formatSuccessRate(Number.NaN)).toBe("—");
  });

  it("formats seconds into compact human durations", () => {
    expect(formatDurationSeconds(0)).toBe("0s");
    expect(formatDurationSeconds(83.4)).toBe("1m 23s");
    expect(formatDurationSeconds(120)).toBe("2m");
    expect(formatDurationSeconds(3661)).toBe("1h 1m");
    expect(formatDurationSeconds(null)).toBe("—");
    expect(formatDurationSeconds(undefined)).toBe("—");
    expect(formatDurationSeconds(-3)).toBe("—");
    expect(formatDurationSeconds(Number.NaN)).toBe("—");
  });

  it("humanizes operation ids", () => {
    expect(humanizeOperationId("lora-train")).toBe("Lora Train");
    expect(humanizeOperationId("image_to_video")).toBe("Image To Video");
    expect(humanizeOperationId("")).toBe("");
  });
});

describe("jobStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = jobStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual([
      "total",
      "in_flight",
      "completed",
      "success_rate",
      "avg_duration",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "—", "—"]);
  });

  it("derives the five authoritative counters", () => {
    expect(jobStatsCards(populated).map((card) => card.value)).toEqual([
      "8",
      "3",
      "5",
      "75%",
      "1m 23s",
    ]);
  });
});

describe("jobStatusRows", () => {
  it("zero-fills every status when the snapshot is absent or empty", () => {
    expect(jobStatusRows().map((row) => [row.status, row.count, row.percent])).toEqual([
      ["queued", 0, 0],
      ["running", 0, 0],
      ["succeeded", 0, 0],
      ["failed", 0, 0],
      ["canceled", 0, 0],
    ]);
    expect(jobStatusRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("merges counts into the canonical order with shares and tones", () => {
    const rows = jobStatusRows({
      ...populated,
      by_status: [
        { status: "failed", count: 2 },
        { status: "succeeded", count: 2 },
      ],
    });
    expect(rows.map((row) => row.status)).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "canceled",
    ]);
    const succeeded = rows.find((row) => row.status === "succeeded");
    const failed = rows.find((row) => row.status === "failed");
    expect(succeeded).toMatchObject({ count: 2, percent: 50, fraction: 0.5, tone: "success" });
    expect(failed).toMatchObject({ count: 2, percent: 50, fraction: 0.5, tone: "danger" });
    expect(rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
  });

  it("ignores unknown or malformed status entries", () => {
    const rows = jobStatusRows({
      ...populated,
      by_status: [
        { status: "queued" as never, count: Number.NaN },
        { status: "running", count: 4 },
      ],
    });
    expect(rows.find((row) => row.status === "running")?.fraction).toBe(1);
    expect(rows.find((row) => row.status === "queued")?.count).toBe(0);
  });
});

describe("jobOperationRows", () => {
  it("returns no rows without a snapshot", () => {
    expect(jobOperationRows()).toEqual([]);
    expect(jobOperationRows(empty)).toEqual([]);
  });

  it("humanizes, sorts by total and derives success shares/tones", () => {
    const rows = jobOperationRows(populated);
    expect(rows.map((row) => row.operationId)).toEqual([
      "lora-train",
      "dataset-prep",
      "image-to-video",
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      "Lora Train",
      "Dataset Prep",
      "Image To Video",
    ]);
    expect(rows[0]).toMatchObject({
      total: 4,
      succeeded: 3,
      failed: 1,
      successPercent: 75,
      successFraction: 0.75,
      tone: "warning",
    });
    expect(rows[1]?.tone).toBe("success");
    expect(rows[2]?.tone).toBe("danger");
  });

  it("breaks total ties by operation id and tolerates malformed rows", () => {
    const rows = jobOperationRows({
      ...populated,
      by_operation: [
        { operation_id: "z-op", total: 2, succeeded: 0, failed: 0 },
        { operation_id: "a-op", total: 2, succeeded: 0, failed: 0 },
      ],
    });
    expect(rows.map((row) => row.operationId)).toEqual(["a-op", "z-op"]);
    expect(rows.every((row) => row.successFraction === 0 && row.tone === "neutral")).toBe(true);
  });
});

describe("hasJobStatsData / generatedAt", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasJobStatsData()).toBe(false);
    expect(hasJobStatsData(empty)).toBe(false);
    expect(hasJobStatsData(populated)).toBe(true);
    expect(hasJobStatsData({ ...empty, by_operation: populated.by_operation })).toBe(true);
  });

  it("formats a compact relative generated-at label", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(jobStatsGeneratedAtLabel(populated, now)).toBe("10m ago");
    expect(jobStatsGeneratedAtLabel({ ...populated, generated_at: "2026-01-01T00:09:45Z" }, now)).toBe("20s ago");
    expect(jobStatsGeneratedAtLabel({ ...populated, generated_at: "2025-12-30T00:00:00Z" }, now)).toBe("2d ago");
    expect(jobStatsGeneratedAtLabel({ ...populated, generated_at: "not-a-date" }, now)).toBe("not-a-date");
    expect(jobStatsGeneratedAtLabel(undefined)).toBe("");
  });
});
