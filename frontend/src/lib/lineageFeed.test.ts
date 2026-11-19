import { describe, expect, it } from "vitest";

import {
  deriveLineageFeed,
  UNKNOWN_LINEAGE_ASSET_NAME,
  UNKNOWN_LINEAGE_PROJECT_NAME,
  validateLineageFeedArgs,
  lineageFeedQueryParams,
} from "./lineageFeed";
import type { AssetRelationshipRecord } from "./lineageStats";
import type { Asset, AssetStatus, Project, RelationshipType } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: CREATOR, created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: CREATOR, created_at: NOW, updated_at: NOW },
];

function asset(id: string, projectId: string, status: AssetStatus = "ready"): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id}`,
    status,
    creator_id: CREATOR,
    version: 1,
    tags: [],
    storage: { key: `assets/${id}.png`, size_bytes: 1024, content_type: "image/png" },
    created_at: "2026-03-18T08:00:00.000Z",
    updated_at: "2026-03-18T08:00:00.000Z",
  };
}

function rel(
  id: string,
  from: string,
  to: string,
  type: RelationshipType,
  createdAt: string,
): AssetRelationshipRecord {
  return { id, from_asset_id: from, to_asset_id: to, type, created_at: createdAt };
}

const ASSETS = [asset(A1, P1), asset(A2, P2), asset(A3, P2)];

const RELATIONSHIPS: readonly AssetRelationshipRecord[] = [
  rel("0b5c1e2a-5000-4000-8000-000000000003", A1, A2, "derived_from", "2026-03-18T08:00:00.000Z"),
  rel("0b5c1e2a-5000-4000-8000-000000000001", A2, A1, "derived_from", "2026-03-18T07:00:00.000Z"),
  rel("0b5c1e2a-5000-4000-8000-000000000002", A3, A2, "uses_input", "2026-03-18T09:00:00.000Z"),
];

describe("deriveLineageFeed", () => {
  it("returns an empty feed when there are no relationships", () => {
    expect(deriveLineageFeed([], ASSETS, PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with an id tie-break and joins asset + project names", () => {
    const feed = deriveLineageFeed([...RELATIONSHIPS].reverse(), ASSETS, PROJECTS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    // 09:00 (A3), 08:00 (A1), 07:00 (A2).
    expect((feed.items ?? []).map((item) => item.id)).toEqual([
      "0b5c1e2a-5000-4000-8000-000000000002",
      "0b5c1e2a-5000-4000-8000-000000000003",
      "0b5c1e2a-5000-4000-8000-000000000001",
    ]);
    expect((feed.items ?? [])[0]).toMatchObject({
      from_asset_id: A3,
      to_asset_id: A2,
      from_asset_name: `asset-${A3}`,
      to_asset_name: `asset-${A2}`,
      project_id: P2,
      project_name: "Brand Film",
      type: "uses_input",
      created_at: "2026-03-18T09:00:00.000Z",
    });
    expect(deriveLineageFeed(RELATIONSHIPS, ASSETS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending relationship id", () => {
    const tied = [
      rel("0b5c1e2a-5000-4000-8000-000000000001", A1, A2, "derived_from", "2026-03-18T09:00:00.000Z"),
      rel("0b5c1e2a-5000-4000-8000-000000000003", A2, A1, "related_to", "2026-03-18T09:00:00.000Z"),
      rel("0b5c1e2a-5000-4000-8000-000000000002", A3, A2, "derived_from", "2026-03-18T09:00:00.000Z"),
    ];
    expect(
      deriveLineageFeed(tied, ASSETS, PROJECTS, NOW).items?.map((item) => item.id),
    ).toEqual([
      "0b5c1e2a-5000-4000-8000-000000000003",
      "0b5c1e2a-5000-4000-8000-000000000002",
      "0b5c1e2a-5000-4000-8000-000000000001",
    ]);
  });

  it("keeps unknown/deleted targets with a fallback name and excludes unknown/deleted sources", () => {
    const withOrphans = [
      ...RELATIONSHIPS,
      rel("0b5c1e2a-5000-4000-8000-0000000000ff", A1, "0b5c1e2a-2000-4000-8000-0000000000fe", "related_to", "2026-03-18T10:00:00.000Z"),
      rel("0b5c1e2a-5000-4000-8000-0000000000fe", "0b5c1e2a-2000-4000-8000-0000000000fd", A1, "derived_from", "2026-03-18T10:00:00.000Z"),
    ];
    const deletedTarget = ASSETS.map((candidate) =>
      candidate.id === A2 ? asset(A2, P2, "deleted") : candidate,
    );
    // A2 is now a deleted target: links pointing at it keep a stable fallback.
    const feed = deriveLineageFeed(withOrphans, deletedTarget, PROJECTS, NOW);
    // r1's source (A2) is deleted and 0fe's source is unknown — both excluded;
    // the remaining three links are kept.
    expect(feed.total).toBe(3);
    for (const item of feed.items ?? []) {
      if (item.to_asset_id === A2) expect(item.to_asset_name).toBe(UNKNOWN_LINEAGE_ASSET_NAME);
    }
    expect((feed.items ?? []).some((item) => item.id.endsWith("0ff"))).toBe(true);
    expect((feed.items ?? []).some((item) => item.id.endsWith("0fe"))).toBe(false);
  });

  it("uses the fallback project name for a link whose source project is missing", () => {
    const orphanProject = asset(A1, "00000000-0000-4000-8000-000000000000");
    const feed = deriveLineageFeed(
      [rel("0b5c1e2a-5000-4000-8000-000000000001", A1, A2, "derived_from", NOW)],
      [orphanProject, ...ASSETS.slice(1)],
      PROJECTS,
      NOW,
    );
    expect((feed.items ?? [])[0]?.project_name).toBe(UNKNOWN_LINEAGE_PROJECT_NAME);
  });

  it("scopes to one project and yields an empty feed for an unknown project", () => {
    const scoped = deriveLineageFeed(RELATIONSHIPS, ASSETS, PROJECTS, NOW, { projectId: P2 });
    // The A2 -> A1 and A3 -> A2 links originate from P2.
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).every((item) => item.project_id === P2)).toBe(true);

    const empty = deriveLineageFeed(RELATIONSHIPS, ASSETS, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });
  });

  it("counts the whole feed before the limit page", () => {
    const paged = deriveLineageFeed(RELATIONSHIPS, ASSETS, PROJECTS, NOW, { limit: 2 });
    expect(paged.total).toBe(3);
    expect(paged.items).toHaveLength(2);
  });
});

describe("lineage feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validateLineageFeedArgs()).not.toThrow();
    expect(() => validateLineageFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateLineageFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(lineageFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(lineageFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});
