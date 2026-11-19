import { describe, expect, it } from "vitest";
import type { UploadStats } from "../../lib/types";
import {
  formatBytes,
  hasUploadStatsData,
  newestUploadLabel,
  uploadProjectLabel,
  uploadProjectRows,
  uploadRelativeLabel,
  uploadStatsCards,
  uploadStatsGeneratedAtLabel,
  uploadStatusLabel,
  uploadStatusRows,
  validUploadStatusCount,
} from "./uploadStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: UploadStats = {
  total_tickets: 10,
  pending: 2,
  completed: 8,
  bytes_uploaded: 2 * 1024 * 1024,
  by_status: [
    { status: "pending", count: 2 },
    { status: "complete", count: 8 },
  ],
  by_project: [
    { project_id: "project-bbbb", total: 3, completed: 3, bytes_uploaded: 1024 * 1024 },
    { project_id: "project-aaaa", total: 7, completed: 5, bytes_uploaded: 1024 * 1024 },
  ],
  newest_upload_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: UploadStats = {
  total_tickets: 0,
  pending: 0,
  completed: 0,
  bytes_uploaded: 0,
  by_status: [
    { status: "pending", count: 0 },
    { status: "complete", count: 0 },
  ],
  by_project: [],
  newest_upload_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("formatBytes", () => {
  it("formats byte counts and treats invalid values safely", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});

describe("upload stats formatters", () => {
  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(uploadRelativeLabel(null)).toBe("");
    expect(uploadRelativeLabel(undefined)).toBe("");
    expect(uploadRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(uploadRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-upload label from the snapshot", () => {
    expect(newestUploadLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestUploadLabel(empty, NOW)).toBe("");
    expect(newestUploadLabel(undefined, NOW)).toBe("");
  });

  it("maps canonical statuses to human labels", () => {
    expect(uploadStatusLabel("pending")).toBe("Pending");
    expect(uploadStatusLabel("complete")).toBe("Complete");
  });

  it("shortens long project ids for compact rows", () => {
    expect(uploadProjectLabel("project-aaaa")).toBe("project-…");
    expect(uploadProjectLabel("abc")).toBe("abc");
    expect(uploadProjectLabel("")).toBe("Unknown");
  });
});

describe("uploadStatsCards", () => {
  it("derives totals, completion and recency signals in a stable order", () => {
    const cards = uploadStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual([
      "tickets",
      "uploaded",
      "completion",
      "newest",
    ]);
    expect(cards.map((card) => card.value)).toEqual([
      "10",
      "2.0 MB",
      "80%",
      "15 minutes ago",
    ]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(uploadStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "—",
      "0%",
      "—",
    ]);
    expect(uploadStatsCards(empty, NOW).map((card) => card.value)).toEqual([
      "0",
      "0 B",
      "0%",
      "—",
    ]);
  });

  it("reports partial completion when only some tickets are done", () => {
    const cards = uploadStatsCards(
      {
        ...populated,
        total_tickets: 4,
        pending: 3,
        completed: 1,
      },
      NOW,
    );
    expect(cards[2]?.value).toBe("25%");
  });
});

describe("uploadStatusRows", () => {
  it("returns a complete zero-filled pending/complete breakdown with shares", () => {
    const rows = uploadStatusRows(populated);
    expect(rows.map((row) => row.status)).toEqual(["pending", "complete"]);
    expect(rows[0]).toMatchObject({
      label: "Pending",
      count: 2,
      percent: 20,
      fraction: 0.2,
      tone: "warning",
    });
    expect(rows[1]).toMatchObject({ label: "Complete", count: 8, percent: 80 });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = uploadStatusRows({
      ...populated,
      by_status: [
        { status: "pending", count: Number.NaN },
        { status: "complete", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(uploadStatusRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(uploadStatusRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("uploadProjectRows", () => {
  it("orders projects by descending ticket count then id with completion shares", () => {
    const rows = uploadProjectRows(populated);
    expect(rows.map((row) => row.projectId)).toEqual(["project-aaaa", "project-bbbb"]);
    expect(rows[0]).toMatchObject({
      label: "project-…",
      total: 7,
      completed: 5,
      completionPercent: 71,
      bytesLabel: "1.0 MB",
    });
  });

  it("returns no rows for absent or empty snapshots and tolerates malformed entries", () => {
    expect(uploadProjectRows(undefined)).toEqual([]);
    expect(uploadProjectRows(empty)).toEqual([]);
    expect(
      uploadProjectRows({
        ...populated,
        by_project: [{ project_id: "p1", total: Number.NaN, completed: 0, bytes_uploaded: 0 }],
      }),
    ).toEqual([]);
  });
});

describe("hasUploadStatsData and validUploadStatusCount", () => {
  it("detects empty snapshots from the authoritative ticket total", () => {
    expect(hasUploadStatsData(populated)).toBe(true);
    expect(hasUploadStatsData(empty)).toBe(false);
    expect(hasUploadStatsData(undefined)).toBe(false);
    expect(hasUploadStatsData({ ...empty, total_tickets: 3 })).toBe(true);
  });

  it("counts only well-formed status buckets", () => {
    expect(validUploadStatusCount(populated)).toBe(2);
    expect(validUploadStatusCount(empty)).toBe(2);
    expect(
      validUploadStatusCount({ ...populated, by_status: [{ status: "complete", count: Number.NaN }] }),
    ).toBe(0);
    expect(validUploadStatusCount(undefined)).toBe(0);
  });
});

describe("uploadStatsGeneratedAtLabel", () => {
  it("derives a generated-at footer label", () => {
    expect(uploadStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(uploadStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
