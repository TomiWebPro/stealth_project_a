import { describe, expect, it } from "vitest";
import type { RetryFeed, RetryFeedItem } from "../../lib/types";
import {
  buildRetryFeedOptions,
  retryAttemptLabel,
  retryCountLabel,
  retryFeedEmptyDescription,
  retryFeedGeneratedAtLabel,
  retryFeedRows,
  retryFeedSummary,
  RETRY_FEED_LIMITS,
} from "./retryFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<RetryFeedItem> = {}): RetryFeedItem {
  return {
    job_id: "job-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    operation_id: "dataset-prep",
    status: "running",
    attempt: 2,
    retries: 1,
    retried_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly RetryFeedItem[], total = items.length): RetryFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildRetryFeedOptions", () => {
  it("omits the project scope when unscoped", () => {
    expect(buildRetryFeedOptions(undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project scope when provided", () => {
    expect(buildRetryFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
  });

  it("offers the canonical page sizes", () => {
    expect(RETRY_FEED_LIMITS).toEqual([10, 25, 50]);
  });
});

describe("retryAttemptLabel / retryCountLabel", () => {
  it("labels positive attempts", () => {
    expect(retryAttemptLabel(1)).toBe("Attempt 1");
    expect(retryAttemptLabel(3)).toBe("Attempt 3");
  });

  it("uses a placeholder for absent or non-positive attempts", () => {
    expect(retryAttemptLabel(0)).toBe("Attempt —");
    expect(retryAttemptLabel(Number.NaN)).toBe("Attempt —");
  });

  it("pluralizes retry counts and zeroes absent values", () => {
    expect(retryCountLabel(1)).toBe("1 retry");
    expect(retryCountLabel(4)).toBe("4 retries");
    expect(retryCountLabel(0)).toBe("0 retries");
    expect(retryCountLabel(Number.NaN)).toBe("0 retries");
  });
});

describe("retryFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(retryFeedRows(undefined, NOW)).toEqual([]);
    expect(retryFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = retryFeedRows(
      feed([
        item(),
        item({
          job_id: "job-bbbb-2222",
          project_id: "proj-bbbb-3333",
          project_name: "Trailer",
          operation_id: "video_gen",
          status: "failed",
          attempt: 3,
          retries: 2,
          retried_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["job-aaaa-1111", "job-bbbb-2222"]);
    expect(rows[0]).toMatchObject({
      jobId: "job-aaaa-1111",
      jobLabel: "job-aaaa…",
      operationId: "dataset-prep",
      operationLabel: "Dataset Prep",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      status: "running",
      statusLabel: "Running",
      statusTone: "info",
      attempt: 2,
      attemptLabel: "Attempt 2",
      retries: 1,
      retriesLabel: "1 retry",
      retriedAt: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      operationLabel: "Video Gen",
      statusLabel: "Failed",
      statusTone: "danger",
      attemptLabel: "Attempt 3",
      retriesLabel: "2 retries",
    });
  });
});

describe("retryFeedSummary", () => {
  it("handles an empty feed", () => {
    expect(retryFeedSummary([], 0)).toBe("No retries");
  });

  it("uses the untruncated total and the newest operation", () => {
    const rows = retryFeedRows(feed([item()], 7), NOW);
    expect(retryFeedSummary(rows, 7)).toBe("7 retries · latest: Dataset Prep");
  });

  it("falls back to the visible row count when no total is given", () => {
    const rows = retryFeedRows(feed([item()], 7), NOW);
    expect(retryFeedSummary(rows)).toBe("1 retry · latest: Dataset Prep");
  });
});

describe("retryFeedGeneratedAtLabel", () => {
  it("returns a relative label for a generated feed", () => {
    expect(retryFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });

  it("returns an empty string when the feed is missing or has no timestamp", () => {
    expect(retryFeedGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(retryFeedGeneratedAtLabel({ total: 0 } as RetryFeed, NOW)).toBe("");
  });
});

describe("retryFeedEmptyDescription", () => {
  it("gives scope-aware copy", () => {
    expect(retryFeedEmptyDescription(false)).toContain("failed job is retried");
    expect(retryFeedEmptyDescription(true)).toContain("this project");
  });
});
