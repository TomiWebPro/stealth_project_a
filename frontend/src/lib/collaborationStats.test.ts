import { describe, expect, it } from "vitest";

import {
  collaborationStatsQueryParams,
  deriveCollaborationStats,
  PRESENCE_STATES,
  validateCollaborationStatsArgs,
} from "./collaborationStats";
import type { Comment, Presence, PresenceState } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const U1 = "0b5c1e2a-0000-4000-8000-0000000000aa";
const U2 = "0b5c1e2a-0000-4000-8000-0000000000bb";
const U3 = "0b5c1e2a-0000-4000-8000-0000000000cc";

function presence(
  userId: string,
  projectId: string,
  state: PresenceState,
  lastSeenAt: string,
): Presence {
  return { user_id: userId, project_id: projectId, state, last_seen_at: lastSeenAt };
}

function comment(
  id: string,
  projectId: string,
  authorId: string,
  createdAt: string,
): Comment {
  return {
    id,
    project_id: projectId,
    asset_id: null,
    author_id: authorId,
    body: "note",
    created_at: createdAt,
  };
}

const C1 = "0b5c1e2a-6200-4000-8000-000000000001";
const C2 = "0b5c1e2a-6200-4000-8000-000000000002";
const C3 = "0b5c1e2a-6200-4000-8000-000000000003";
const C4 = "0b5c1e2a-6200-4000-8000-000000000004";

describe("deriveCollaborationStats", () => {
  it("zero-fills every presence state when both collections are empty", () => {
    expect(deriveCollaborationStats([], [], NOW)).toEqual({
      total_presence: 0,
      total_comments: 0,
      total_participants: 0,
      by_state: PRESENCE_STATES.map((state) => ({ state, count: 0 })),
      by_project: [],
      newest_presence_at: null,
      newest_comment_at: null,
      generated_at: NOW,
    });
  });

  it("derives zero-filled state counts, project activity, participants and recency", () => {
    // Unsorted input proves the derivation does not depend on store order.
    const stats = deriveCollaborationStats(
      [
        presence(U1, P1, "online", "2026-03-18T09:00:00.000Z"),
        presence(U2, P1, "away", NOW),
        presence(U3, P2, "offline", "2026-03-18T08:00:00.000Z"),
      ],
      [comment(C1, P1, U1, "2026-03-18T07:00:00.000Z"), comment(C2, P2, U3, NOW)],
      NOW,
    );
    expect(stats.by_state).toEqual([
      { state: "online", count: 1 },
      { state: "away", count: 1 },
      { state: "offline", count: 1 },
    ]);
    // Most-commented project first; both have one comment, so presence count
    // breaks the tie in favour of P1.
    expect(stats.by_project).toEqual([
      { project_id: P1, comments: 1, presence: 2 },
      { project_id: P2, comments: 1, presence: 1 },
    ]);
    // U1 and U3 appear in both collections; participants must be deduplicated.
    expect(stats.total_participants).toBe(3);
    expect(stats.newest_presence_at).toBe(NOW);
    expect(stats.newest_comment_at).toBe(NOW);
    expect(stats.generated_at).toBe(NOW);
  });

  it("breaks per-project and recency ties deterministically", () => {
    const presences = [
      presence(U2, P1, "online", NOW),
      presence(U1, P1, "online", NOW),
      presence(U3, P2, "offline", NOW),
    ];
    const comments = [
      comment(C2, P1, U1, NOW),
      comment(C1, P1, U2, NOW),
      comment(C3, P2, U3, "2026-03-18T09:00:00.000Z"),
      comment(C4, P2, U3, "2026-03-18T08:00:00.000Z"),
    ];
    const forward = deriveCollaborationStats(presences, comments, NOW);
    expect(forward).toEqual(deriveCollaborationStats([...presences].reverse(), [...comments].reverse(), NOW));
    // Same comment count; P1 has more presence records so it still ranks first.
    expect(forward.by_project).toEqual([
      { project_id: P1, comments: 2, presence: 2 },
      { project_id: P2, comments: 2, presence: 1 },
    ]);
    // Recency ties resolve to the lexicographically greatest record key.
    expect(forward.newest_presence_at).toBe(NOW);
    expect(forward.newest_comment_at).toBe(NOW);
  });

  it("scopes the derivation to one project without mutating the global seed", () => {
    const presences = [presence(U1, P1, "online", NOW), presence(U2, P2, "away", NOW)];
    const comments = [comment(C1, P1, U1, NOW), comment(C2, P2, U2, NOW)];
    const scoped = deriveCollaborationStats(presences, comments, NOW, { projectId: P2 });
    expect(scoped.total_presence).toBe(1);
    expect(scoped.total_comments).toBe(1);
    expect(scoped.by_project).toEqual([{ project_id: P2, comments: 1, presence: 1 }]);
    expect(scoped.total_participants).toBe(1);

    // A valid but unseeded project yields the zero-filled empty snapshot.
    const empty = deriveCollaborationStats(presences, comments, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_presence).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_presence_at).toBeNull();
    expect(empty.by_state?.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("counts a presence-only and a comment-only project in the same breakdown", () => {
    const stats = deriveCollaborationStats(
      [presence(U1, P1, "online", NOW)],
      [comment(C3, P2, U2, NOW)],
      NOW,
    );
    // Descending comment count wins over presence count, so the comment-only
    // project ranks first.
    expect(stats.by_project).toEqual([
      { project_id: P2, comments: 1, presence: 0 },
      { project_id: P1, comments: 0, presence: 1 },
    ]);
    expect(stats.total_participants).toBe(2);
  });
});

describe("collaboration stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateCollaborationStatsArgs()).not.toThrow();
    expect(() => validateCollaborationStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateCollaborationStatsArgs({ projectId: "not-a-uuid" });
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
    expect(collaborationStatsQueryParams()).toEqual({ project_id: undefined });
    expect(collaborationStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
