import { describe, expect, it } from "vitest";

import {
  deriveVersionFeed,
  UNKNOWN_VERSION_PROJECT_NAME,
  validateVersionFeedArgs,
  versionFeedQueryParams,
} from "./versionFeed";
import type { AssetVersionFeedRecord } from "./versionFeed";
import type { Asset, AssetStatus, Project } from "./types";

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

function version(
  assetId: string,
  number: number,
  createdAt: string,
  createdBy = CREATOR,
): AssetVersionFeedRecord {
  return { asset_id: assetId, version: number, created_at: createdAt, created_by: createdBy };
}

const ASSETS = [asset(A1, P1), asset(A2, P2), asset(A3, P2)];

const VERSIONS: readonly AssetVersionFeedRecord[] = [
  version(A1, 1, "2026-03-18T08:00:00.000Z"),
  version(A2, 1, "2026-03-18T07:00:00.000Z"),
  version(A2, 2, "2026-03-18T09:00:00.000Z"),
  version(A3, 1, "2026-03-18T06:00:00.000Z"),
];

describe("deriveVersionFeed", () => {
  it("returns an empty feed when there are no versions", () => {
    expect(deriveVersionFeed([], ASSETS, PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with asset-id/version tie-breaks and joins project + asset names", () => {
    const feed = deriveVersionFeed([...VERSIONS].reverse(), ASSETS, PROJECTS, NOW);

    expect(feed.total).toBe(4);
    expect(feed.generated_at).toBe(NOW);
    // 09:00 (A2 v2), 08:00 (A1 v1), 07:00 (A2 v1), 06:00 (A3 v1).
    expect((feed.items ?? []).map((item) => [item.asset_id, item.version])).toEqual([
      [A2, 2],
      [A1, 1],
      [A2, 1],
      [A3, 1],
    ]);
    expect((feed.items ?? [])[0]).toMatchObject({
      asset_id: A2,
      project_id: P2,
      project_name: "Brand Film",
      asset_name: `asset-${A2}`,
      asset_type: "image",
      version: 2,
      created_by: CREATOR,
      created_at: "2026-03-18T09:00:00.000Z",
    });
    expect(deriveVersionFeed(VERSIONS, ASSETS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending asset id then version", () => {
    const tied = [
      version(A2, 1, "2026-03-18T09:00:00.000Z"),
      version(A1, 1, "2026-03-18T09:00:00.000Z"),
      version(A1, 2, "2026-03-18T09:00:00.000Z"),
    ];
    expect(
      deriveVersionFeed(tied, ASSETS, PROJECTS, NOW).items?.map((item) => [
        item.asset_id,
        item.version,
      ]),
    ).toEqual([
      [A2, 1],
      [A1, 2],
      [A1, 1],
    ]);
  });

  it("uses the fallback project name for a version whose asset project is missing", () => {
    const orphanProject = asset(A1, "00000000-0000-4000-8000-000000000000");
    const feed = deriveVersionFeed(
      [version(A1, 1, NOW)],
      [orphanProject],
      PROJECTS,
      NOW,
    );
    expect((feed.items ?? [])[0]?.project_name).toBe(UNKNOWN_VERSION_PROJECT_NAME);
  });

  it("excludes soft-deleted/unknown-asset versions and scopes to one project", () => {
    const withOrphans = [
      ...VERSIONS,
      version("0b5c1e2a-2000-4000-8000-0000000000ff", 5, "2026-03-18T10:00:00.000Z"),
    ];
    const deletedAssets = ASSETS.map((candidate) =>
      candidate.id === A3 ? asset(A3, P2, "deleted") : candidate,
    );

    const all = deriveVersionFeed(withOrphans, deletedAssets, PROJECTS, NOW);
    // A3's version (asset deleted) and the orphan record are excluded.
    expect(all.total).toBe(3);
    expect((all.items ?? []).map((item) => item.asset_id)).toEqual([A2, A1, A2]);

    const scoped = deriveVersionFeed(withOrphans, deletedAssets, PROJECTS, NOW, {
      projectId: P2,
    });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.asset_id)).toEqual([A2, A2]);

    const empty = deriveVersionFeed(withOrphans, deletedAssets, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });
  });

  it("counts the whole feed before the limit page", () => {
    const paged = deriveVersionFeed(VERSIONS, ASSETS, PROJECTS, NOW, { limit: 2 });
    expect(paged.total).toBe(4);
    expect((paged.items ?? []).map((item) => item.version)).toEqual([2, 1]);
  });
});

describe("version feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validateVersionFeedArgs()).not.toThrow();
    expect(() => validateVersionFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateVersionFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(versionFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(versionFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});
