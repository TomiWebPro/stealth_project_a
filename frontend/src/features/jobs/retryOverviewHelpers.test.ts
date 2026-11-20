import { describe, expect, it } from "vitest";
import type { RetryFeed, RetryFeedItem, RetryOverview } from "../../lib/types";
import {
  RETRY_OVERVIEW_LIMITS,
  RETRY_OVERVIEW_RECENT_LIMIT,
  buildRetryOverviewOptions,
  hasRetryOverviewData,
  retryOverviewActiveOption,
  retryOverviewEmptyDescription,
  retryOverviewGeneratedAtLabel,
  retryOverviewIdentity,
  retryOverviewJobRetries,
  retryOverviewPickerOptions,
  retryOverviewProjectJobs,
  retryOverviewProjectRetries,
  retryOverviewRecentSiblings,
  retryOverviewRelativeLabel,
  retryOverviewStatRows,
  retryOverviewStatusLabel,
  retryOverviewStatusTone,
  retryOverviewSummaryLabel,
  retryOverviewTotalRetries,
} from "./retryOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function sibling(overrides: Partial<RetryFeedItem> = {}): RetryFeedItem {
  return {
    job_id: "job-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    operation_id: "image-to-video",
    status: "failed" as const,
    attempt: 2,
    retries: 1,
    retried_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<RetryOverview> = {}): RetryOverview {
  return {
    job_id: "job-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    operation_id: "image-to-video",
    status: "succeeded",
    attempt: 2,
    retries: 1,
    retried_at: "2026-01-01T00:59:00Z",
    counts: {
      project_retries: 3,
      project_jobs: 2,
      total_retries: 12,
    },
    recent_siblings: [sibling()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function feed(): RetryFeed {
  return {
    items: [
      sibling(),
      sibling({
        job_id: "job-bbbb-3333",
        operation_id: "text-to-image",
        status: "running",
        attempt: 3,
        retries: 2,
      }),
    ],
    total: 2,
    generated_at: "2026-01-01T00:59:30Z",
  };
}

describe("buildRetryOverviewOptions", () => {
  it("defaults to the canonical recent bound", () => {
    expect(buildRetryOverviewOptions()).toEqual({ recentLimit: RETRY_OVERVIEW_RECENT_LIMIT });
  });

  it("passes through an explicit page bound", () => {
    expect(buildRetryOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("exposes the three offered page-size chips", () => {
    expect(RETRY_OVERVIEW_LIMITS).toEqual([5, 10, 25]);
  });
});

describe("count helpers", () => {
  it("reads each authoritative count bucket", () => {
    expect(retryOverviewTotalRetries(overview())).toBe(12);
    expect(retryOverviewProjectRetries(overview())).toBe(3);
    expect(retryOverviewProjectJobs(overview())).toBe(2);
    expect(retryOverviewJobRetries(overview())).toBe(1);
  });

  it("zero-fills absent, negative and non-finite counts", () => {
    expect(retryOverviewTotalRetries()).toBe(0);
    expect(retryOverviewProjectRetries(overview({ counts: { project_retries: -2 } as never }))).toBe(0);
    expect(retryOverviewProjectJobs(overview({ counts: { project_jobs: Number.NaN } as never }))).toBe(0);
    expect(retryOverviewJobRetries(overview({ retries: Number.NaN }))).toBe(0);
  });
});

describe("relative labels", () => {
  it("formats retry and generated-at timestamps against the given clock", () => {
    expect(retryOverviewRelativeLabel("2026-01-01T00:59:00Z", NOW)).toBe("1 minute ago");
    expect(retryOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
  });

  it("returns an empty label for absent timestamps", () => {
    expect(retryOverviewRelativeLabel()).toBe("");
    expect(retryOverviewGeneratedAtLabel()).toBe("");
  });
});

describe("status helpers", () => {
  it("uses the canonical job-status label and tone", () => {
    expect(retryOverviewStatusLabel("succeeded")).toBe("Succeeded");
    expect(retryOverviewStatusTone("failed")).toBe("danger");
  });

  it("is safe for a missing status", () => {
    expect(retryOverviewStatusLabel()).toBe("—");
    expect(retryOverviewStatusTone()).toBe("neutral");
  });
});

describe("retryOverviewIdentity", () => {
  it("derives header badges and labels from the snapshot", () => {
    expect(retryOverviewIdentity(overview(), NOW)).toEqual({
      statusLabel: "Succeeded",
      statusTone: "success",
      jobLabel: "job-aaaa…",
      operationLabel: "Image To Video",
      projectLabel: "A Short Film",
      attemptLabel: "Attempt 2",
      retriesLabel: "1 retry",
      retriedLabel: "1 minute ago",
    });
  });

  it("returns render-safe values for a missing snapshot", () => {
    expect(retryOverviewIdentity(undefined, NOW)).toEqual({
      statusLabel: "—",
      statusTone: "neutral",
      jobLabel: "Unknown",
      operationLabel: "Unknown operation",
      projectLabel: "",
      attemptLabel: "Attempt —",
      retriesLabel: "0 retries",
      retriedLabel: "",
    });
  });
});

describe("retryOverviewStatRows", () => {
  it("emits four zero-filled counters in a stable order", () => {
    expect(retryOverviewStatRows().map((row) => row.key)).toEqual([
      "workspace",
      "project",
      "jobs",
      "selected",
    ]);
    expect(retryOverviewStatRows().every((row) => row.value === "0")).toBe(true);
  });

  it("uses the authoritative counts for a populated snapshot", () => {
    const rows = retryOverviewStatRows(overview());
    expect(rows.map((row) => row.value)).toEqual(["12", "3", "2", "1"]);
  });
});

describe("retryOverviewRecentSiblings", () => {
  it("is empty for a missing snapshot", () => {
    expect(retryOverviewRecentSiblings()).toEqual([]);
  });

  it("projects siblings and highlights the selected job", () => {
    const rows = retryOverviewRecentSiblings(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "job-aaaa-1111",
      statusLabel: "Failed",
      statusTone: "danger",
      attemptLabel: "Attempt 2",
      retriesLabel: "1 retry",
      relativeTime: "1 minute ago",
      isCurrent: true,
    });
  });

  it("does not highlight a different selected job", () => {
    const rows = retryOverviewRecentSiblings(overview({ job_id: "job-other-9999" }), NOW);
    expect(rows[0]?.isCurrent).toBe(false);
  });
});

describe("hasRetryOverviewData", () => {
  it("is false for a missing or entirely zero-filled snapshot", () => {
    expect(hasRetryOverviewData()).toBe(false);
    expect(
      hasRetryOverviewData(
        overview({ counts: { project_retries: 0, project_jobs: 0, total_retries: 0 }, recent_siblings: [] }),
      ),
    ).toBe(false);
  });

  it("is true when there are retries or siblings", () => {
    expect(hasRetryOverviewData(overview())).toBe(true);
    expect(hasRetryOverviewData(overview({ counts: { project_retries: 0, project_jobs: 0, total_retries: 0 } }))).toBe(true);
  });
});

describe("summary and empty copy", () => {
  it("summarizes the selected job's retries and attempt", () => {
    expect(retryOverviewSummaryLabel()).toBe("");
    expect(retryOverviewSummaryLabel(overview())).toBe("1 retry · Attempt 2");
  });

  it("provides scope-aware empty descriptions", () => {
    expect(retryOverviewEmptyDescription(true)).toContain("this project");
    expect(retryOverviewEmptyDescription(false)).toContain("failed job");
  });
});

describe("picker options", () => {
  it("maps feed items to job-id-keyed options in wire order", () => {
    const options = retryOverviewPickerOptions(feed());
    expect(options.map((option) => option.jobId)).toEqual(["job-aaaa-1111", "job-bbbb-3333"]);
    expect(options[0]?.value).toBe("job-aaaa-1111");
    expect(options[0]?.label).toContain("A Short Film");
  });

  it("is empty for a missing feed", () => {
    expect(retryOverviewPickerOptions(undefined)).toEqual([]);
  });

  it("resolves the selected option and falls back to the first", () => {
    const options = retryOverviewPickerOptions(feed());
    expect(retryOverviewActiveOption(options, "job-bbbb-3333")?.jobId).toBe("job-bbbb-3333");
    expect(retryOverviewActiveOption(options, "missing")?.jobId).toBe("job-aaaa-1111");
    expect(retryOverviewActiveOption([], "")).toBeUndefined();
  });
});
