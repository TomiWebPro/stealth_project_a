import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { Comment, Presence, Project } from "./types";
import {
  collaborationFeedQueryParams,
  deriveCollaborationFeed,
  UNKNOWN_COLLABORATION_PROJECT_NAME,
  validateCollaborationFeedArgs,
} from "./collaborationFeed";

const NOW = "2026-11-19T12:00:00Z";

const projects: Project[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Moonshot",
    org_id: "aaaaaaaa-1111-4111-8111-111111111111",
    description: null,
    archived: false,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const presences: Presence[] = [
  {
    user_id: "22222222-2222-4222-8222-222222222222",
    project_id: projects[0]!.id,
    state: "online",
    last_seen_at: "2026-01-02T00:00:00Z",
  },
];

const comments: Comment[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    project_id: projects[0]!.id,
    asset_id: "44444444-4444-4444-8444-444444444444",
    author_id: "55555555-5555-4555-8555-555555555555",
    body: "Lock the silhouette.",
    created_at: "2026-01-03T00:00:00Z",
  },
];

describe("deriveCollaborationFeed", () => {
  it("projects presence and comment signals into one newest-first feed", () => {
    const feed = deriveCollaborationFeed(presences, comments, projects, NOW);
    expect(feed.total).toBe(2);
    expect((feed.items ?? []).map((item) => item.signal)).toEqual(["comment", "presence"]);
    expect(feed.items?.[0]).toMatchObject({
      signal_id: comments[0]!.id,
      signal: "comment",
      project_id: projects[0]!.id,
      project_name: "Moonshot",
      actor_id: comments[0]!.author_id,
      state: null,
      body: "Lock the silhouette.",
      asset_id: comments[0]!.asset_id,
      occurred_at: comments[0]!.created_at,
    });
    expect(feed.items?.[1]).toMatchObject({
      signal_id: presences[0]!.user_id,
      signal: "presence",
      actor_id: presences[0]!.user_id,
      state: "online",
      body: null,
      asset_id: null,
      occurred_at: presences[0]!.last_seen_at,
    });
    expect(feed.generated_at).toBe(NOW);
  });

  it("filters to one signal kind", () => {
    const presenceOnly = deriveCollaborationFeed(presences, comments, projects, NOW, {
      signal: "presence",
    });
    expect(presenceOnly.total).toBe(1);
    expect(presenceOnly.items?.[0]?.signal).toBe("presence");

    const commentOnly = deriveCollaborationFeed(presences, comments, projects, NOW, {
      signal: "comment",
    });
    expect(commentOnly.total).toBe(1);
    expect(commentOnly.items?.[0]?.signal).toBe("comment");
  });

  it("falls back to a stable project name for an unjoined project", () => {
    const feed = deriveCollaborationFeed(presences, comments, [], NOW);
    expect(feed.items?.every((item) => item.project_name === UNKNOWN_COLLABORATION_PROJECT_NAME)).toBe(
      true,
    );
  });

  it("scopes to one project and zero-fills an unseeded project", () => {
    const scoped = deriveCollaborationFeed(presences, comments, projects, NOW, {
      projectId: projects[0]!.id,
    });
    expect(scoped.total).toBe(2);
    const empty = deriveCollaborationFeed(presences, comments, projects, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });
  });

  it("bounds the page with a whole-scope total before paging", () => {
    const feed = deriveCollaborationFeed(presences, comments, projects, NOW, { limit: 1 });
    expect(feed.total).toBe(2);
    expect(feed.items ?? []).toHaveLength(1);
  });

  it("breaks ties deterministically by signal id, then signal, then project id", () => {
    const tiedPresence: Presence = {
      ...presences[0]!,
      user_id: "aaaaaaaa-0000-4000-8000-000000000000",
      last_seen_at: "2026-01-03T00:00:00Z",
    };
    const tiedComment: Comment = {
      ...comments[0]!,
      id: "bbbbbbbb-0000-4000-8000-000000000000",
      created_at: "2026-01-03T00:00:00Z",
    };
    const feed = deriveCollaborationFeed([tiedPresence], [tiedComment], projects, NOW);
    // Same occurred_at: comment id "bbbb" sorts before presence id "aaaa" descending.
    expect((feed.items ?? []).map((item) => item.signal_id)).toEqual([
      "bbbbbbbb-0000-4000-8000-000000000000",
      "aaaaaaaa-0000-4000-8000-000000000000",
    ]);
  });

  it("returns an empty feed for empty stores", () => {
    expect(deriveCollaborationFeed([], [], projects, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });
});

describe("validateCollaborationFeedArgs", () => {
  it("accepts empty options and well-formed scopes/filters/limits", () => {
    expect(() => validateCollaborationFeedArgs()).not.toThrow();
    expect(() =>
      validateCollaborationFeedArgs({
        projectId: "11111111-1111-4111-8111-111111111111",
        signal: "comment",
        limit: 200,
      }),
    ).not.toThrow();
  });

  it("rejects a malformed project id with a 422", () => {
    expect(() => validateCollaborationFeedArgs({ projectId: "not-a-uuid" })).toThrowError(ApiError);
  });

  it("rejects an unknown signal with a 422", () => {
    expect(() =>
      validateCollaborationFeedArgs({ signal: "bogus" as never }),
    ).toThrowError(ApiError);
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateCollaborationFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("collaborationFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(
      collaborationFeedQueryParams({
        projectId: "11111111-1111-4111-8111-111111111111",
        signal: "presence",
        limit: 5,
      }),
    ).toEqual({
      project_id: "11111111-1111-4111-8111-111111111111",
      signal: "presence",
      limit: 5,
    });
    expect(collaborationFeedQueryParams()).toEqual({
      project_id: undefined,
      signal: undefined,
      limit: undefined,
    });
  });
});
