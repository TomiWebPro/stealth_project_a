import { describe, expect, it } from "vitest";

import {
  SEARCH_STAT_KINDS,
  deriveSearchStats,
  searchStatsQueryParams,
  validateSearchStatsArgs,
} from "./searchStats";
import type { Asset, Conversation, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const U1 = "0b5c1e2a-2000-4000-8000-000000000001";

function project(id: string, updatedAt: string): Project {
  return {
    id,
    org_id: "0b5c1e2a-3000-4000-8000-000000000001",
    name: `project-${id}`,
    created_by: U1,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

function asset(
  id: string,
  projectId: string,
  updatedAt: string,
  status?: Asset["status"],
): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id}`,
    creator_id: U1,
    storage: { key: `Output/${id}.png`, size_bytes: 12, content_type: "image/png" },
    ...(status ? { status } : {}),
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

function conversation(id: string, projectId: string, updatedAt: string): Conversation {
  return {
    id,
    project_id: projectId,
    title: `conversation-${id}`,
    created_by: U1,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe("deriveSearchStats", () => {
  it("zero-fills every search kind when the document stores are empty", () => {
    expect(deriveSearchStats([], [], [], NOW)).toEqual({
      total_documents: 0,
      by_kind: SEARCH_STAT_KINDS.map((kind) => ({ kind, count: 0 })),
      newest_document_at: null,
      generated_at: NOW,
    });
  });

  it("counts searchable documents by kind, excludes deleted assets and finds recency", () => {
    // Unsorted, deliberately newest-last input proves recency is a max, not a head.
    const stats = deriveSearchStats(
      [project(P1, "2026-03-18T08:00:00.000Z"), project(P2, "2026-03-18T09:00:00.000Z")],
      [
        asset("a1", P1, "2026-03-18T07:00:00.000Z"),
        asset("a2", P1, "2026-03-18T06:00:00.000Z", "deleted"),
        asset("a3", P2, "2026-03-18T07:30:00.000Z"),
      ],
      [conversation("c1", P1, "2026-03-18T09:15:00.000Z")],
      NOW,
    );
    expect(stats.total_documents).toBe(5); // 2 projects + 2 live assets + 1 conversation
    expect(stats.by_kind).toEqual([
      { kind: "project", count: 2 },
      { kind: "asset", count: 2 },
      { kind: "conversation", count: 1 },
    ]);
    expect(stats.newest_document_at).toBe("2026-03-18T09:15:00.000Z");
    expect(stats.generated_at).toBe(NOW);
  });

  it("scopes the derivation to one project and zero-fills an unseeded project", () => {
    const projects = [project(P1, NOW), project(P2, NOW)];
    const assets = [asset("a1", P1, NOW), asset("a2", P2, NOW)];
    const conversations = [conversation("c1", P1, NOW), conversation("c2", P2, NOW)];

    const scoped = deriveSearchStats(projects, assets, conversations, NOW, { projectId: P1 });
    expect(scoped.by_kind).toEqual([
      { kind: "project", count: 1 },
      { kind: "asset", count: 1 },
      { kind: "conversation", count: 1 },
    ]);
    expect(scoped.total_documents).toBe(3);
    expect(scoped.newest_document_at).toBe(NOW);

    const empty = deriveSearchStats(projects, assets, conversations, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_documents).toBe(0);
    expect(empty.by_kind?.every((bucket) => bucket.count === 0)).toBe(true);
    expect(empty.newest_document_at).toBeNull();
    expect(empty.generated_at).toBe(NOW);
  });

  it("ignores input order", () => {
    const projects = [project(P1, NOW), project(P2, NOW)];
    const assets = [asset("a1", P1, NOW), asset("a2", P2, NOW)];
    const conversations = [conversation("c1", P1, NOW)];
    const forward = deriveSearchStats(projects, assets, conversations, NOW);
    expect(forward).toEqual(
      deriveSearchStats([...projects].reverse(), [...assets].reverse(), [...conversations].reverse(), NOW),
    );
  });
});

describe("search stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateSearchStatsArgs()).not.toThrow();
    expect(() => validateSearchStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateSearchStatsArgs({ projectId: "not-a-uuid" });
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
    expect(searchStatsQueryParams()).toEqual({ project_id: undefined });
    expect(searchStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
