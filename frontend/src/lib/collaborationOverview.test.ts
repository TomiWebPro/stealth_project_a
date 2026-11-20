import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { Comment, Presence, Project } from "./types";
import {
  DEFAULT_COLLABORATION_OVERVIEW_RECENT_LIMIT,
  UNKNOWN_COLLABORATION_OVERVIEW_PROJECT_NAME,
  buildCollaborationSignalKey,
  collaborationOverviewQueryParams,
  deriveCollaborationOverview,
  validateCollaborationOverviewArgs,
} from "./collaborationOverview";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const C1 = "0b5c1e2a-6200-4000-8000-000000000001";
const C2 = "0b5c1e2a-6200-4000-8000-000000000002";
const ACTOR_A = "0b5c1e2a-0000-4000-8000-0000000000aa";
const ACTOR_B = "0b5c1e2a-0000-4000-8000-0000000000bb";
const ACTOR_C = "0b5c1e2a-0000-4000-8000-0000000000cc";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: ACTOR_A, created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: ACTOR_A, created_at: NOW, updated_at: NOW },
];

const PRESENCES: readonly Presence[] = [
  { user_id: ACTOR_A, project_id: P1, state: "online", last_seen_at: "2026-03-18T09:00:00.000Z" },
  { user_id: ACTOR_B, project_id: P1, state: "away", last_seen_at: "2026-03-18T07:00:00.000Z" },
  { user_id: ACTOR_C, project_id: P2, state: "offline", last_seen_at: "2026-03-18T05:00:00.000Z" },
];

const COMMENTS: readonly Comment[] = [
  {
    id: C1,
    project_id: P1,
    author_id: ACTOR_B,
    body: "Looks good",
    created_at: "2026-03-18T08:30:00.000Z",
  },
  {
    id: C2,
    project_id: P2,
    author_id: ACTOR_A,
    body: "Ship it",
    created_at: "2026-03-18T06:00:00.000Z",
  },
];

const SEEDS = { presences: PRESENCES, comments: COMMENTS, projects: PROJECTS, now: NOW };
const TARGET = buildCollaborationSignalKey("presence", P1, ACTOR_A);

describe("deriveCollaborationOverview", () => {
  it("derives identity, joined project, project-scoped counts and newest-first siblings", () => {
    const overview = deriveCollaborationOverview(TARGET, SEEDS);

    expect(overview).toMatchObject({
      signal_id: ACTOR_A,
      signal: "presence",
      project_id: P1,
      project_name: "Moonshot",
      actor_id: ACTOR_A,
      state: "online",
      body: null,
      asset_id: null,
      occurred_at: "2026-03-18T09:00:00.000Z",
      generated_at: NOW,
    });
    expect(overview.counts).toEqual({
      project_signals: 3,
      project_presence: 2,
      project_comments: 1,
      project_participants: 2,
      workspace_signals: 5,
      // Zero-filled over the canonical states, scoped to the viewed signal's project.
      by_state: [
        { state: "online", count: 1 },
        { state: "away", count: 1 },
        { state: "offline", count: 0 },
      ],
    });
    // Siblings are same-project (P2's signals are excluded), newest-first.
    expect(overview.recent_signals?.map((item) => item.signal_id)).toEqual([ACTOR_A, C1, ACTOR_B]);
  });

  it("surfaces a comment signal's body and asset reference", () => {
    const overview = deriveCollaborationOverview(
      buildCollaborationSignalKey("comment", P1, C1),
      SEEDS,
    );

    expect(overview).toMatchObject({
      signal_id: C1,
      signal: "comment",
      actor_id: ACTOR_B,
      state: null,
      body: "Looks good",
      asset_id: null,
    });
  });

  it("bounds the sibling page by recentLimit without bounding the counts", () => {
    const overview = deriveCollaborationOverview(TARGET, SEEDS, { recentLimit: 1 });

    expect(overview.recent_signals).toHaveLength(1);
    expect(overview.recent_signals?.[0]?.signal_id).toBe(ACTOR_A);
    expect(overview.counts).toEqual(deriveCollaborationOverview(TARGET, SEEDS).counts);
  });

  it("uses the unknown-project fallback for an orphan project", () => {
    const orphan = buildCollaborationSignalKey(
      "presence",
      "00000000-0000-4000-8000-000000000000",
      ACTOR_A,
    );
    const overview = deriveCollaborationOverview(orphan, {
      ...SEEDS,
      presences: [
        {
          user_id: ACTOR_A,
          project_id: "00000000-0000-4000-8000-000000000000",
          state: "online",
          last_seen_at: "2026-03-18T09:00:00.000Z",
        },
      ],
      comments: [],
    });

    expect(overview.project_name).toBe(UNKNOWN_COLLABORATION_OVERVIEW_PROJECT_NAME);
    expect(overview.recent_signals?.[0]?.project_id).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("throws a collaboration_signal_not_found 404 for a well-formed key with no live signal", () => {
    try {
      deriveCollaborationOverview(
        buildCollaborationSignalKey("presence", P1, "00000000-0000-4000-8000-000000000000"),
        SEEDS,
      );
      throw new Error("expected derivation to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect(cause).toMatchObject({ status: 404, code: "collaboration_signal_not_found" });
    }
  });
});

describe("validateCollaborationOverviewArgs", () => {
  it("accepts a well-formed key and default options", () => {
    expect(() => validateCollaborationOverviewArgs(TARGET)).not.toThrow();
    expect(() =>
      validateCollaborationOverviewArgs(TARGET, {
        recentLimit: DEFAULT_COLLABORATION_OVERVIEW_RECENT_LIMIT,
      }),
    ).not.toThrow();
  });

  it.each([
    "not-a-key",
    `bogus:${P1}:${ACTOR_A}`,
    `presence:${P1}`,
    `presence:${P1}:${ACTOR_A}:extra`,
    `presence:not-a-uuid:${ACTOR_A}`,
    `presence:${P1}:not-a-uuid`,
    `presence::${ACTOR_A}`,
  ])("rejects a malformed signal key (%s)", (signalKey) => {
    expect(() => validateCollaborationOverviewArgs(signalKey)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateCollaborationOverviewArgs(TARGET, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("collaborationOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(collaborationOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(collaborationOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
