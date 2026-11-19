import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { Asset, Comment, Project } from "./types";
import type { AssetRelationshipRecord } from "./lineageStats";
import type { AssetVersionFeedRecord } from "./versionFeed";
import {
  DEFAULT_ASSET_OVERVIEW_RECENT_LIMIT,
  assetOverviewQueryParams,
  deriveAssetOverview,
  validateAssetOverviewArgs,
} from "./assetOverview";
import type { AssetOverviewSeeds } from "./assetOverview";

const ASSET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name: `project-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: PROJECT_A,
    type: "image",
    name: `asset-${id}`,
    status: "ready",
    creator_id: CREATOR,
    storage: { key: `assets/${id}`, size_bytes: 100, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function version(
  versionNumber: number,
  createdAt: string,
  assetId = ASSET_A,
): AssetVersionFeedRecord {
  return { asset_id: assetId, version: versionNumber, created_at: createdAt, created_by: CREATOR };
}

function relationship(
  id: string,
  from: string,
  to: string,
  type: AssetRelationshipRecord["type"] = "derived_from",
): AssetRelationshipRecord {
  return {
    id,
    from_asset_id: from,
    to_asset_id: to,
    type,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function comment(id: string, assetId: string): Comment {
  return {
    id,
    project_id: PROJECT_A,
    author_id: "u1",
    body: `comment-${id}`,
    created_at: "2026-01-01T00:00:00.000Z",
    asset_id: assetId,
  };
}

const receipt = (version = 1): Record<string, unknown> => ({
  version,
  size_bytes: 100,
  published_at: "2026-01-02T00:00:00.000Z",
  comment: "ok",
  publisher: CREATOR,
});

function seeds(overrides: Partial<AssetOverviewSeeds> = {}): AssetOverviewSeeds {
  return {
    projects: [project(PROJECT_A)],
    assets: [asset(ASSET_A)],
    assetVersions: [],
    relationships: [],
    comments: [],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

describe("deriveAssetOverview", () => {
  it("zero-fills counts and the recent-version list for an asset with no data", () => {
    const overview = deriveAssetOverview(ASSET_A, seeds());
    expect(overview).toEqual({
      asset_id: ASSET_A,
      asset_name: `asset-${ASSET_A}`,
      asset_type: "image",
      status: "ready",
      version: 1,
      project_id: PROJECT_A,
      project_name: `project-${PROJECT_A}`,
      created_at: "2026-01-01T00:00:00.000Z",
      published: false,
      counts: { versions: 0, upstream: 0, downstream: 0, comments: 0, tags: 0 },
      recent_versions: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives identity, the published flag, tags, comments and version counts", () => {
    const overview = deriveAssetOverview(
      ASSET_A,
      seeds({
        projects: [project(PROJECT_A, { name: "Moonshot" })],
        assets: [
          asset(ASSET_A, {
            name: "Hero frame",
            type: "video",
            status: "processing",
            version: 3,
            tags: ["hero", "s01"],
            metadata: { publish_receipt: receipt(1) },
          }),
        ],
        assetVersions: [
          version(1, "2026-01-01T00:00:00.000Z"),
          version(2, "2026-01-02T00:00:00.000Z"),
          version(3, "2026-01-03T00:00:00.000Z"),
          version(1, "2026-01-01T00:00:00.000Z", "other-asset"),
        ],
        comments: [comment("m1", ASSET_A), comment("m2", ASSET_A), comment("m3", "other-asset")],
      }),
    );
    expect(overview.asset_name).toBe("Hero frame");
    expect(overview.asset_type).toBe("video");
    expect(overview.status).toBe("processing");
    expect(overview.version).toBe(3);
    expect(overview.project_name).toBe("Moonshot");
    expect(overview.published).toBe(true);
    expect(overview.counts).toEqual({
      versions: 3,
      upstream: 0,
      downstream: 0,
      comments: 2,
      tags: 2,
    });
  });

  it("falls back to 'Unknown project' when the parent project is missing", () => {
    const overview = deriveAssetOverview(ASSET_A, seeds({ projects: [] }));
    expect(overview.project_name).toBe("Unknown project");
  });

  it("counts distinct live lineage neighbours and ignores non-lineage, self and deleted links", () => {
    const parentA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const parentB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const parentTwice = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const childA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const childB = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const deletedChild = "12121212-1212-4212-8212-121212121212";
    const overview = deriveAssetOverview(
      ASSET_A,
      seeds({
        assets: [
          asset(ASSET_A),
          asset(parentA),
          asset(parentB),
          asset(parentTwice),
          asset(childA),
          asset(childB),
          asset(deletedChild, { status: "deleted" }),
        ],
        relationships: [
          // three distinct parents (one duplicated, one via variant_of, one via uses_input)
          relationship("r1", ASSET_A, parentA, "derived_from"),
          relationship("r2", ASSET_A, parentB, "variant_of"),
          relationship("r3", ASSET_A, parentTwice, "uses_input"),
          relationship("r4", ASSET_A, parentTwice, "derived_from"), // duplicate
          // two distinct live children, one deleted, one related_to (not lineage)
          relationship("r5", childA, ASSET_A, "derived_from"),
          relationship("r6", childB, ASSET_A, "duplicate_of"),
          relationship("r7", deletedChild, ASSET_A, "derived_from"), // deleted excluded
          relationship("r8", childA, ASSET_A, "related_to"), // not a lineage edge
          relationship("r9", ASSET_A, ASSET_A, "derived_from"), // self, ignored
        ],
      }),
    );
    expect(overview.counts.upstream).toBe(3);
    expect(overview.counts.downstream).toBe(2);
  });

  it("returns recent versions newest-version-first, carries storage and bounds them", () => {
    const root = asset(ASSET_A, { storage: { key: "Output/hero_v3.mp4", size_bytes: 4096, content_type: "video/mp4" } });
    const overview = deriveAssetOverview(
      ASSET_A,
      seeds({
        assets: [root],
        assetVersions: [
          version(1, "2026-01-01T00:00:00.000Z"),
          version(3, "2026-01-03T00:00:00.000Z"),
          version(2, "2026-01-02T00:00:00.000Z"),
        ],
      }),
      { recentLimit: 2 },
    );
    expect(overview.counts.versions).toBe(3); // whole stream, not the page
    expect(overview.recent_versions?.map((item) => item.version)).toEqual([3, 2]);
    expect(overview.recent_versions?.[0]?.storage).toEqual(root.storage);
    expect(overview.recent_versions?.[0]?.created_by).toBe(CREATOR);
  });

  it("defaults the recent limit to five", () => {
    const assetVersions = Array.from({ length: 7 }, (_, index) =>
      version(index + 1, `2026-01-0${index + 1}T00:00:00.000Z`),
    );
    const overview = deriveAssetOverview(ASSET_A, seeds({ assetVersions }));
    expect(overview.recent_versions).toHaveLength(DEFAULT_ASSET_OVERVIEW_RECENT_LIMIT);
  });

  it("rejects an unknown asset with a 404", () => {
    expect(() => deriveAssetOverview(ASSET_A, seeds({ assets: [] }))).toThrow(
      expect.objectContaining({ status: 404, code: "not_found" }),
    );
  });
});

describe("validateAssetOverviewArgs", () => {
  it("accepts a well-formed id and an in-range recent limit", () => {
    expect(() => validateAssetOverviewArgs(ASSET_A, { recentLimit: 50 })).not.toThrow();
    expect(() => validateAssetOverviewArgs(ASSET_A)).not.toThrow();
  });

  it("mirrors the router 422 envelope for a malformed id or out-of-range limit", () => {
    for (const bad of [
      () => validateAssetOverviewArgs("not-a-uuid"),
      () => validateAssetOverviewArgs(ASSET_A, { recentLimit: 0 }),
      () => validateAssetOverviewArgs(ASSET_A, { recentLimit: 51 }),
    ]) {
      try {
        bad();
        throw new Error("expected a validation error");
      } catch (cause) {
        expect(cause).toBeInstanceOf(ApiError);
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });
});

describe("assetOverviewQueryParams", () => {
  it("maps the recent limit to the wire query parameter", () => {
    expect(assetOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(assetOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });
});
