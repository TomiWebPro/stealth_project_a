import { describe, expect, it } from "vitest";
import type { UploadFeed, UploadFeedItem } from "../../lib/types";
import {
  UPLOAD_FEED_LIMITS,
  buildUploadFeedOptions,
  uploadFeedEmptyDescription,
  uploadFeedGeneratedAtLabel,
  uploadFeedRows,
  uploadFeedSummary,
} from "./uploadFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const completeItem: UploadFeedItem = {
  upload_id: "upload-bbbb-1111",
  project_id: "proj-aaaa-2222",
  project_name: "A Short Film",
  filename: "shot_01_plate.mov",
  content_type: "video/quicktime",
  status: "complete",
  declared_size: 2 * 1024 * 1024,
  size_bytes: 1024 * 1024,
  created_at: "2026-01-01T00:45:00Z",
  expires_at: "2026-01-03T02:00:00Z",
};

const pendingItem: UploadFeedItem = {
  upload_id: "upload-aaaa-3333",
  project_id: "proj-cccc-4444",
  project_name: "Unknown project",
  filename: "character_ref.png",
  content_type: "image/png",
  status: "pending",
  declared_size: 512,
  size_bytes: 0,
  created_at: "2026-01-01T00:30:00Z",
  expires_at: "2026-01-03T02:00:00Z",
};

const populated: UploadFeed = {
  items: [completeItem, pendingItem],
  total: 7,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: UploadFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

describe("upload feed display helpers", () => {
  it("builds hook options with an optional project scope and bounded page size", () => {
    expect(buildUploadFeedOptions(undefined, 25)).toEqual({ limit: 25 });
    expect(buildUploadFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
    expect(UPLOAD_FEED_LIMITS).toEqual([10, 25, 50]);
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = uploadFeedRows(populated, NOW);
    expect(rows.map((row) => row.uploadId)).toEqual(["upload-bbbb-1111", "upload-aaaa-3333"]);
    expect(rows[0]).toMatchObject({
      id: "upload-bbbb-1111",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      filename: "shot_01_plate.mov",
      contentType: "video/quicktime",
      status: "complete",
      statusLabel: "Complete",
      statusTone: "success",
      declaredSizeLabel: "2.0 MB",
      sizeLabel: "1.0 MB",
      relativeTime: "15 minutes ago",
      expiresLabel: "in 2 days",
      timestamp: "2026-01-01T00:45:00Z",
    });
    expect(rows[1]).toMatchObject({
      status: "pending",
      statusLabel: "Pending",
      statusTone: "warning",
      declaredSizeLabel: "512 B",
      sizeLabel: "0 B",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing or empty feed", () => {
    expect(uploadFeedRows(undefined, NOW)).toEqual([]);
    expect(uploadFeedRows(empty, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(uploadFeedSummary(uploadFeedRows(populated, NOW), 7)).toBe(
      "7 tickets · latest: shot_01_plate.mov",
    );
    expect(uploadFeedSummary(uploadFeedRows(populated, NOW))).toBe(
      "2 tickets · latest: shot_01_plate.mov",
    );
    expect(uploadFeedSummary([], 0)).toBe("No upload tickets");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(uploadFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(uploadFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(uploadFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives scope-aware empty-state copy", () => {
    expect(uploadFeedEmptyDescription(false)).toContain("Upload tickets");
    expect(uploadFeedEmptyDescription(true)).toContain("this project");
  });

  it("falls back to neutral status presentation for an unexpected status", () => {
    const rows = uploadFeedRows({
      ...populated,
      items: [{ ...completeItem, status: "unknown" as "complete" }],
    });
    expect(rows[0]?.statusLabel).toBe("Ticket");
    expect(rows[0]?.statusTone).toBe("neutral");
  });
});
