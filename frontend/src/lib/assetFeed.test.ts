import { describe, expect, it } from "vitest";

import {
  assetFeedQueryParams,
  deriveAssetFeed,
  UNKNOWN_ASSET_PROJECT_NAME,
  validateAssetFeedArgs,
} from "./assetFeed";
import type { Asset, AssetStatus, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function asset(
  id: string,
  projectId: string,
  createdAt: string,
  overrides: Partial<Asset> = {},
): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `Asset ${id.slice(-1)}`,
    status: "ready",
    creator_id: "user",
    version: 1,
    storage: { key: `Output/${id}.png`, size_bytes: 1024, content_type: "image/png" },
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  };
}

const ASSETS: readonly Asset[] = [
  asset(A1, P1, "2026-03-18T08:00:00.000Z", { name: "Design frame", version: 3 }),
  asset(A2, P2, "2026-03-18T09:00:00.000Z", { type: "video", status: "processing" }),
  asset(A3, P2, "2026-03-18T08:00:00.000Z", { status: "deleted" as AssetStatus }),
];

describe("deriveAssetFeed", () => {
  it("returns an empty feed when there are no assets", () => {
    expect(deriveAssetFeed([], PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with an asset-id tie-break and joins project names", () => {
    const feed = deriveAssetFeed([...ASSETS].reverse(), PROJECTS, NOW);

    expect(feed.total).toBe(2);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.asset_id)).toEqual([A2, A1]);
    expect((feed.items ?? [])[0]).toMatchObject({
      asset_id: A2,
      project_id: P2,
      project_name: "Brand Film",
      type: "video",
      name: "Asset 2",
      status: "processing",
      version: 1,
      size_bytes: 1024,
    });
    expect(deriveAssetFeed(ASSETS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending asset id", () => {
    const tied = [
      asset(A1, P1, "2026-03-18T08:00:00.000Z"),
      asset(A2, P1, "2026-03-18T08:00:00.000Z"),
    ];
    expect(
      deriveAssetFeed(tied, PROJECTS, NOW).items?.map((item) => item.asset_id),
    ).toEqual([A2, A1]);
  });

  it("excludes soft-deleted assets and defaults status/version to the backend schema", () => {
    const minimal = asset(A1, P1, NOW, { status: undefined, version: undefined });
    const feed = deriveAssetFeed([minimal, ASSETS[2]!], PROJECTS, NOW);
    expect(feed.total).toBe(1);
    expect((feed.items ?? [])[0]).toMatchObject({ asset_id: A1, status: "ready", version: 1 });
  });

  it("uses the fallback project name for an asset whose project is missing", () => {
    const orphan = asset(A1, "00000000-0000-4000-8000-000000000000", NOW);
    const feed = deriveAssetFeed([orphan], PROJECTS, NOW);
    expect((feed.items ?? [])[0]?.project_name).toBe(UNKNOWN_ASSET_PROJECT_NAME);
  });

  it("scopes to one project and counts the whole feed before the limit page", () => {
    const scoped = deriveAssetFeed(ASSETS, PROJECTS, NOW, { projectId: P2 });
    expect(scoped.total).toBe(1);
    expect((scoped.items ?? []).map((item) => item.asset_id)).toEqual([A2]);

    const empty = deriveAssetFeed(ASSETS, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = deriveAssetFeed(ASSETS, PROJECTS, NOW, { limit: 1 });
    expect(paged.total).toBe(2);
    expect((paged.items ?? []).map((item) => item.asset_id)).toEqual([A2]);
  });
});

describe("asset feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validateAssetFeedArgs()).not.toThrow();
    expect(() => validateAssetFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateAssetFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(assetFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(assetFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});
