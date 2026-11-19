import { describe, expect, it } from "vitest";
import type { JobFeed, JobFeedItem } from "../../lib/types";
import {
  buildJobFeedOptions,
  JOB_FEED_LIMITS,
  JOB_FEED_STATUS_FILTERS,
  jobFeedAttemptLabel,
  jobFeedEmptyDescription,
  jobFeedGeneratedAtLabel,
  jobFeedProgressPercent,
  jobFeedRows,
  jobFeedStatusChipLabel,
  jobFeedSummary,
} from "./jobFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<JobFeedItem> = {}): JobFeedItem {
  return {
    job_id: "job-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    operation_id: "dataset-prep",
    status: "running",
    progress: 0.42,
    attempt: 1,
    created_by: "user-aaaa-3333",
    created_at: "2026-01-01T00:45:00Z",
    started_at: "2026-01-01T00:46:00Z",
    finished_at: null,
    ...overrides,
  };
}

function feed(items: readonly JobFeedItem[], total = items.length): JobFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("jobFeedProgressPercent", () => {
  it("converts 0..1 progress to a rounded percentage", () => {
    expect(jobFeedProgressPercent(0)).toBe(0);
    expect(jobFeedProgressPercent(0.42)).toBe(42);
    expect(jobFeedProgressPercent(1)).toBe(100);
  });

  it("clamps out-of-range and non-finite values", () => {
    expect(jobFeedProgressPercent(-1)).toBe(0);
    expect(jobFeedProgressPercent(2)).toBe(100);
    expect(jobFeedProgressPercent(Number.NaN)).toBe(0);
  });
});

describe("jobFeedAttemptLabel", () => {
  it("labels valid attempts and is defensive for malformed values", () => {
    expect(jobFeedAttemptLabel(1)).toBe("attempt 1");
    expect(jobFeedAttemptLabel(3)).toBe("attempt 3");
    expect(jobFeedAttemptLabel(0)).toBe("attempt ?");
    expect(jobFeedAttemptLabel(Number.NaN)).toBe("attempt ?");
  });
});

describe("buildJobFeedOptions", () => {
  it("omits both scopes when unscoped", () => {
    expect(buildJobFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project and status scopes when provided", () => {
    expect(buildJobFeedOptions("proj-aaaa-2222", "failed", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      status: "failed",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and status chips", () => {
    expect(JOB_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(JOB_FEED_STATUS_FILTERS).toEqual([
      undefined,
      "queued",
      "running",
      "succeeded",
      "failed",
      "canceled",
    ]);
  });
});

describe("jobFeedStatusChipLabel", () => {
  it("labels the unfiltered chip and each canonical status", () => {
    expect(jobFeedStatusChipLabel(undefined)).toBe("All");
    expect(jobFeedStatusChipLabel("running")).toBe("Running");
    expect(jobFeedStatusChipLabel("failed")).toBe("Failed");
  });
});

describe("jobFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(jobFeedRows(undefined, NOW)).toEqual([]);
    expect(jobFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = jobFeedRows(
      feed([
        item(),
        item({
          job_id: "job-bbbb-2222",
          project_id: "proj-bbbb-3333",
          project_name: "Trailer",
          operation_id: "lora_train",
          status: "succeeded",
          progress: 1,
          attempt: 2,
          created_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.jobId)).toEqual(["job-aaaa-1111", "job-bbbb-2222"]);
    expect(rows[0]).toMatchObject({
      id: "job-aaaa-1111",
      jobId: "job-aaaa-1111",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      operationId: "dataset-prep",
      operationLabel: "Dataset Prep",
      status: "running",
      statusLabel: "Running",
      statusTone: "info",
      progressPercent: 42,
      attemptLabel: "attempt 1",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      operationLabel: "Lora Train",
      statusLabel: "Succeeded",
      statusTone: "success",
      progressPercent: 100,
      attemptLabel: "attempt 2",
    });
  });

  it("uses defensive progress/attempt values for malformed data", () => {
    const rows = jobFeedRows(
      feed([item({ progress: Number.NaN, attempt: 0 })]),
      NOW,
    );
    expect(rows[0]?.progressPercent).toBe(0);
    expect(rows[0]?.attemptLabel).toBe("attempt ?");
  });
});

describe("jobFeedSummary", () => {
  it("uses the whole-scope total and the newest operation label", () => {
    const rows = jobFeedRows(feed([item()], 42), NOW);
    expect(jobFeedSummary(rows, 42)).toBe("42 jobs · latest: Dataset Prep");
  });

  it("falls back to the visible row count and handles a single row", () => {
    const rows = jobFeedRows(feed([item()]), NOW);
    expect(jobFeedSummary(rows)).toBe("1 job · latest: Dataset Prep");
  });

  it("reports an empty summary when there are no rows", () => {
    expect(jobFeedSummary([])).toBe("No jobs");
  });
});

describe("jobFeedGeneratedAtLabel", () => {
  it("formats a generated-at timestamp relative to now", () => {
    expect(jobFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });

  it("returns an empty label when the feed is missing", () => {
    expect(jobFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("jobFeedEmptyDescription", () => {
  it("is scope- and filter-aware", () => {
    expect(jobFeedEmptyDescription(false, false)).toContain("submitted");
    expect(jobFeedEmptyDescription(true, false)).toContain("this project");
    expect(jobFeedEmptyDescription(true, true)).toContain("status filter");
  });
});
