import { describe, expect, it } from "vitest";

import {
  ACTIVITY_STAT_KINDS,
  activityStatsQueryParams,
  deriveActivityStats,
  validateActivityStatsArgs,
} from "./activityStats";
import type { Asset, Comment, Job } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const U1 = "0b5c1e2a-2000-4000-8000-000000000001";
const U2 = "0b5c1e2a-2000-4000-8000-000000000002";
const U3 = "0b5c1e2a-2000-4000-8000-000000000003";

function asset(
  id: string,
  projectId: string,
  creatorId: string,
  createdAt: string,
  publishReceipt?: Record<string, unknown>,
): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id}`,
    creator_id: creatorId,
    storage: { key: `Output/${id}.png`, size_bytes: 12, content_type: "image/png" },
    ...(publishReceipt ? { metadata: { publish_receipt: publishReceipt } } : {}),
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function job(id: string, projectId: string, creatorId: string, createdAt: string): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "text-to-image",
    schema_version: "1",
    status: "succeeded",
    created_by: creatorId,
    created_at: createdAt,
  };
}

function comment(id: string, projectId: string, authorId: string, createdAt: string): Comment {
  return { id, project_id: projectId, author_id: authorId, body: "note", created_at: createdAt };
}

describe("deriveActivityStats", () => {
  it("zero-fills every activity kind when the stores are empty", () => {
    expect(deriveActivityStats([], [], [], NOW)).toEqual({
      total_events: 0,
      total_participants: 0,
      by_kind: ACTIVITY_STAT_KINDS.map((kind) => ({ kind, count: 0 })),
      by_project: [],
      newest_event_at: null,
      generated_at: NOW,
    });
  });

  it("derives totals, kind/project breakdowns, distinct participants and recency", () => {
    // Unsorted input proves the derivation does not depend on store order.
    const stats = deriveActivityStats(
      [
        asset("a2", P2, U2, "2026-03-18T08:00:00.000Z"),
        asset("a1", P1, U1, "2026-03-18T09:00:00.000Z", {
          publisher: U3,
          comment: "approved",
        }),
      ],
      [
        job("j2", P2, U2, "2026-03-18T08:30:00.000Z"),
        job("j1", P1, U1, NOW),
      ],
      [comment("c1", P1, U1, "2026-03-18T09:30:00.000Z")],
      NOW,
    );

    // 2 asset + 1 publish + 2 job + 1 comment = 6 events.
    expect(stats.total_events).toBe(6);
    expect(stats.by_kind).toEqual([
      { kind: "asset", count: 2 },
      { kind: "publish", count: 1 },
      { kind: "job", count: 2 },
      { kind: "comment", count: 1 },
    ]);
    // U1, U2 and the publish receipt's U3 are the three distinct actors.
    expect(stats.total_participants).toBe(3);
    // P1 has 4 events (asset+publish+job+comment), P2 has 2 (asset+job).
    expect(stats.by_project).toEqual([
      { project_id: P1, events: 4, participants: 2 },
      { project_id: P2, events: 2, participants: 1 },
    ]);
    expect(stats.newest_event_at).toBe(NOW);
    expect(stats.generated_at).toBe(NOW);
  });

  it("breaks per-project ties deterministically and ignores input order", () => {
    const assets = [asset("a1", P1, U1, NOW), asset("a2", P2, U2, NOW)];
    const jobs = [job("j1", P1, U1, NOW), job("j2", P2, U2, NOW)];
    const forward = deriveActivityStats(assets, jobs, [], NOW);
    expect(forward).toEqual(
      deriveActivityStats([...assets].reverse(), [...jobs].reverse(), [], NOW),
    );
    expect(forward.by_project).toEqual([
      { project_id: P1, events: 2, participants: 1 },
      { project_id: P2, events: 2, participants: 1 },
    ]);
  });

  it("scopes the derivation to one project and zero-fills an unseeded project", () => {
    const assets = [asset("a1", P1, U1, NOW), asset("a2", P2, U2, NOW)];
    const jobs = [job("j1", P1, U1, NOW), job("j2", P2, U2, NOW)];
    const scoped = deriveActivityStats(assets, jobs, [], NOW, { projectId: P1 });
    expect(scoped.total_events).toBe(2);
    expect(scoped.total_participants).toBe(1);
    expect(scoped.by_project).toEqual([
      { project_id: P1, events: 2, participants: 1 },
    ]);
    expect(scoped.by_kind).toEqual([
      { kind: "asset", count: 1 },
      { kind: "publish", count: 0 },
      { kind: "job", count: 1 },
      { kind: "comment", count: 0 },
    ]);

    const empty = deriveActivityStats(assets, jobs, [], NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_events).toBe(0);
    expect(empty.total_participants).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_event_at).toBeNull();
    expect(empty.by_kind?.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("activity stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateActivityStatsArgs()).not.toThrow();
    expect(() => validateActivityStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateActivityStatsArgs({ projectId: "not-a-uuid" });
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
    expect(activityStatsQueryParams()).toEqual({ project_id: undefined });
    expect(activityStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
