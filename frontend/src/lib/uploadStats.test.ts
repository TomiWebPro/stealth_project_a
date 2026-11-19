import { describe, expect, it } from "vitest";

import {
  UPLOAD_STATUSES,
  deriveUploadStats,
  uploadStatsQueryParams,
  validateUploadStatsArgs,
} from "./uploadStats";
import type { UploadRecord } from "./uploadStats";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const U1 = "0b5c1e2a-2000-4000-8000-000000000001";

function ticket(
  id: string,
  projectId: string,
  status: UploadRecord["status"],
  sizeBytes: number,
  createdAt: string,
): UploadRecord {
  return { upload_id: id, project_id: projectId, status, size_bytes: sizeBytes, created_at: createdAt };
}

describe("deriveUploadStats", () => {
  it("zero-fills every status bucket when the upload store is empty", () => {
    expect(deriveUploadStats([], NOW)).toEqual({
      total_tickets: 0,
      pending: 0,
      completed: 0,
      bytes_uploaded: 0,
      by_status: UPLOAD_STATUSES.map((status) => ({ status, count: 0 })),
      by_project: [],
      newest_upload_at: null,
      generated_at: NOW,
    });
  });

  it("counts tickets by status, excludes pending bytes and finds recency", () => {
    // Unsorted, deliberately newest-last input proves recency is a max, not a head.
    const stats = deriveUploadStats(
      [
        ticket(U1, P1, "complete", 1_200_000, "2026-03-18T08:00:00.000Z"),
        ticket(U1 + "a", P1, "pending", 900_000, "2026-03-18T09:00:00.000Z"),
        ticket(U1 + "b", P2, "complete", 250_000, "2026-03-18T07:30:00.000Z"),
        ticket(U1 + "c", P2, "complete", 50_000, "2026-03-18T09:15:00.000Z"),
      ],
      NOW,
    );

    expect(stats.total_tickets).toBe(4);
    expect(stats.pending).toBe(1);
    expect(stats.completed).toBe(3);
    // The pending ticket's 900k declared bytes must not contribute.
    expect(stats.bytes_uploaded).toBe(1_500_000);
    expect(stats.by_status).toEqual([
      { status: "pending", count: 1 },
      { status: "complete", count: 3 },
    ]);
    expect(stats.newest_upload_at).toBe("2026-03-18T09:15:00.000Z");
    expect(stats.generated_at).toBe(NOW);
  });

  it("orders per-project activity by descending count then project id", () => {
    const stats = deriveUploadStats(
      [
        ticket(U1, P2, "complete", 100, "2026-03-18T08:00:00.000Z"),
        ticket(U1 + "a", P1, "complete", 200, "2026-03-18T08:00:00.000Z"),
        ticket(U1 + "b", P1, "pending", 300, "2026-03-18T08:00:00.000Z"),
        ticket(U1 + "c", P1, "complete", 400, "2026-03-18T08:00:00.000Z"),
      ],
      NOW,
    );

    expect(stats.by_project).toEqual([
      { project_id: P1, total: 3, completed: 2, bytes_uploaded: 600 },
      { project_id: P2, total: 1, completed: 1, bytes_uploaded: 100 },
    ]);
  });

  it("scopes the derivation to one project and zero-fills an unseeded project", () => {
    const records = [
      ticket(U1, P1, "complete", 100, "2026-03-18T08:00:00.000Z"),
      ticket(U1 + "a", P2, "pending", 200, "2026-03-18T09:00:00.000Z"),
    ];

    const scoped = deriveUploadStats(records, NOW, { projectId: P1 });
    expect(scoped.total_tickets).toBe(1);
    expect(scoped.completed).toBe(1);
    expect(scoped.bytes_uploaded).toBe(100);
    expect(scoped.by_project).toHaveLength(1);

    const empty = deriveUploadStats(records, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_tickets).toBe(0);
    expect(empty.by_status?.every((bucket) => bucket.count === 0)).toBe(true);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_upload_at).toBeNull();
  });

  it("ignores input order", () => {
    const records = [
      ticket(U1, P1, "complete", 100, "2026-03-18T08:00:00.000Z"),
      ticket(U1 + "a", P2, "pending", 200, "2026-03-18T09:00:00.000Z"),
      ticket(U1 + "b", P1, "complete", 300, "2026-03-18T07:00:00.000Z"),
    ];
    expect(deriveUploadStats(records, NOW)).toEqual(deriveUploadStats([...records].reverse(), NOW));
  });
});

describe("upload stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateUploadStatsArgs()).not.toThrow();
    expect(() => validateUploadStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateUploadStatsArgs({ projectId: "not-a-uuid" });
      throw new Error("expected validation to fail");
    } catch (cause) {
      expect(cause).toMatchObject({
        status: 422,
        code: "validation_error",
        details: [{ field: "project_id" }],
      });
    }
  });

  it("maps the project scope onto the live query string", () => {
    expect(uploadStatsQueryParams()).toEqual({ project_id: undefined });
    expect(uploadStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
