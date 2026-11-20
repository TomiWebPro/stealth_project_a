import { describe, expect, it } from "vitest";
import type { UploadFeed, UploadFeedItem, UploadOverview } from "../../lib/types";
import {
  buildUploadPickerFeedOptions,
  hasUploadOverviewData,
  shortUploadOverviewId,
  UPLOAD_OVERVIEW_PICKER_LIMIT,
  uploadOptionLabel,
  uploadOverviewCounts,
  uploadOverviewCountRows,
  uploadOverviewEmptyDescription,
  uploadOverviewGeneratedAtLabel,
  uploadOverviewIdentity,
  uploadOverviewProgress,
  uploadOverviewRelativeLabel,
  uploadOverviewStatRows,
  uploadOverviewSummaryLabel,
  uploadPickerOptions,
} from "./uploadOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<UploadOverview> = {}): UploadOverview {
  return {
    upload_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "A Short Film",
    filename: "shot_01_plate.mov",
    content_type: "video/quicktime",
    status: "complete",
    declared_size: 2 * 1024 * 1024,
    size_bytes: 1024 * 1024,
    bytes_remaining: 1024 * 1024,
    progress: 0.5,
    expired: false,
    created_at: "2026-01-01T00:45:00Z",
    expires_at: "2026-01-03T02:00:00Z",
    counts: {
      project_tickets: 4,
      project_completed: 3,
      project_bytes_uploaded: 6 * 1024 * 1024,
    },
    generated_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

function feedItem(overrides: Partial<UploadFeedItem> = {}): UploadFeedItem {
  return {
    upload_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "A Short Film",
    filename: "shot_01_plate.mov",
    content_type: "video/quicktime",
    status: "complete",
    declared_size: 2 * 1024 * 1024,
    size_bytes: 1024 * 1024,
    created_at: "2026-01-01T00:45:00Z",
    expires_at: "2026-01-03T02:00:00Z",
    ...overrides,
  };
}

function feed(items: readonly UploadFeedItem[]): UploadFeed {
  return { items: [...items], total: items.length, generated_at: "2026-01-01T00:59:00Z" };
}

describe("upload overview query option helpers", () => {
  it("builds a bounded, project-scoped picker feed", () => {
    expect(buildUploadPickerFeedOptions()).toEqual({ limit: UPLOAD_OVERVIEW_PICKER_LIMIT });
    expect(buildUploadPickerFeedOptions("11111111-1111-4111-8111-111111111111")).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      limit: UPLOAD_OVERVIEW_PICKER_LIMIT,
    });
  });
});

describe("upload picker options", () => {
  it("labels a ticket with its filename, short id, project and status", () => {
    expect(uploadOptionLabel(feedItem())).toBe(
      "shot_01_plate.mov · aaaaaaaa… · A Short Film · Complete",
    );
    expect(
      uploadOptionLabel(feedItem({ filename: "  ", project_name: "", status: "pending" })),
    ).toBe("Untitled upload · aaaaaaaa… · Unknown project · Pending");
  });

  it("maps feed items into stable options and tolerates missing feeds", () => {
    expect(uploadPickerOptions()).toEqual([]);
    expect(uploadPickerOptions(feed([]))).toEqual([]);
    expect(
      uploadPickerOptions(
        feed([
          feedItem(),
          feedItem({
            upload_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
            filename: "plate_v2.mov",
            status: "pending",
          }),
        ]),
      ),
    ).toEqual([
      {
        value: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        label: "shot_01_plate.mov · aaaaaaaa… · A Short Film · Complete",
      },
      {
        value: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        label: "plate_v2.mov · bbbbbbbb… · A Short Film · Pending",
      },
    ]);
  });

  it("shortens ids and falls back for missing ones", () => {
    expect(shortUploadOverviewId("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa")).toBe("aaaaaaaa…");
    expect(shortUploadOverviewId("short")).toBe("short");
    expect(shortUploadOverviewId()).toBe("—");
  });
});

describe("uploadOverviewRelativeLabel / generated at", () => {
  it("is empty when absent and relative when present", () => {
    expect(uploadOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(uploadOverviewRelativeLabel("2026-01-01T00:45:00Z", NOW)).toBe("15 minutes ago");
    expect(uploadOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(uploadOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
  });
});

describe("uploadOverviewCounts / progress", () => {
  it("zero-fills and truncates malformed counts", () => {
    expect(uploadOverviewCounts()).toEqual({
      projectTickets: 0,
      projectCompleted: 0,
      projectBytesUploaded: 0,
    });
    expect(uploadOverviewCounts(overview())).toEqual({
      projectTickets: 4,
      projectCompleted: 3,
      projectBytesUploaded: 6 * 1024 * 1024,
    });
    expect(
      uploadOverviewCounts(
        overview({
          counts: {
            project_tickets: -1,
            project_completed: 2.9,
            project_bytes_uploaded: Number.NaN,
          },
        }),
      ),
    ).toEqual({ projectTickets: 0, projectCompleted: 2, projectBytesUploaded: 0 });
  });

  it("clamps progress and falls back to the byte ratio", () => {
    expect(uploadOverviewProgress(overview())).toEqual({ fraction: 0.5, percent: 50 });
    expect(
      uploadOverviewProgress(overview({ progress: 3.4 })),
    ).toEqual({ fraction: 1, percent: 100 });
    expect(uploadOverviewProgress(overview({ progress: -1 }))).toEqual({
      fraction: 0,
      percent: 0,
    });
    // Missing/invalid progress is derived from uploaded / declared bytes.
    expect(
      uploadOverviewProgress(overview({ progress: Number.NaN, declared_size: 200, size_bytes: 50 })),
    ).toEqual({ fraction: 0.25, percent: 25 });
    expect(uploadOverviewProgress()).toEqual({ fraction: 0, percent: 0 });
  });
});

describe("uploadOverviewIdentity", () => {
  it("derives ticket/project/lifecycle labels and recency", () => {
    expect(uploadOverviewIdentity(overview(), NOW)).toEqual({
      filename: "shot_01_plate.mov",
      uploadIdLabel: "aaaaaaaa…",
      projectName: "A Short Film",
      projectId: "11111111-1111-4111-8111-111111111111",
      contentType: "video/quicktime",
      statusLabel: "Complete",
      statusTone: "success",
      expired: false,
      createdLabel: "15 minutes ago",
      expiresLabel: "in 2 days",
    });
  });

  it("falls back for a missing snapshot or blank fields", () => {
    expect(uploadOverviewIdentity(undefined, NOW)).toEqual({
      filename: "Untitled upload",
      uploadIdLabel: "—",
      projectName: "Unknown project",
      projectId: "",
      contentType: "Unknown type",
      statusLabel: "Ticket",
      statusTone: "neutral",
      expired: false,
      createdLabel: "",
      expiresLabel: "",
    });
    expect(
      uploadOverviewIdentity(
        overview({ filename: "  ", project_name: "", content_type: "", expired: true }),
        NOW,
      ),
    ).toMatchObject({
      filename: "Untitled upload",
      projectName: "Unknown project",
      contentType: "Unknown type",
      expired: true,
    });
  });
});

describe("uploadOverviewStatRows / count rows", () => {
  it("renders byte-accounting cards and zero-fills a missing snapshot", () => {
    const rows = uploadOverviewStatRows(overview());
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ["declared", "2.0 MB"],
      ["uploaded", "1.0 MB"],
      ["remaining", "1.0 MB"],
      ["progress", "50%"],
    ]);
    expect(uploadOverviewStatRows().every((row) => row.value === "0%" || row.value === "—")).toBe(
      true,
    );
  });

  it("renders whole-project activity counts", () => {
    expect(uploadOverviewCountRows(overview()).map((row) => [row.key, row.value])).toEqual([
      ["project-tickets", "4"],
      ["project-completed", "3"],
      ["project-bytes", "6.0 MB"],
    ]);
    expect(uploadOverviewCountRows().map((row) => row.value)).toEqual(["0", "0", "0 B"]);
  });
});

describe("uploadOverviewSummaryLabel / hasUploadOverviewData / empty copy", () => {
  it("summarizes the ticket and detects missing, empty and populated snapshots", () => {
    expect(uploadOverviewSummaryLabel()).toBe("");
    expect(uploadOverviewSummaryLabel(overview())).toBe(
      "shot_01_plate.mov · A Short Film · Complete · 50% complete",
    );
    expect(hasUploadOverviewData()).toBe(false);
    expect(
      hasUploadOverviewData(
        overview({
          declared_size: 0,
          size_bytes: 0,
          counts: { project_tickets: 0, project_completed: 0, project_bytes_uploaded: 0 },
        }),
      ),
    ).toBe(false);
    expect(hasUploadOverviewData(overview())).toBe(true);
  });

  it("uses scope-aware empty copy", () => {
    expect(uploadOverviewEmptyDescription(true)).toContain("this project");
    expect(uploadOverviewEmptyDescription(false)).toContain("staged for ingestion");
  });
});
