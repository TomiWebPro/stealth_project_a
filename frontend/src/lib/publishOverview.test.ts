import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { UNKNOWN_PROJECT_NAME } from "./publishFeed";
import type { Asset, AssetStatus, Metadata, Project } from "./types";
import {
  DEFAULT_PUBLISH_OVERVIEW_RECENT_LIMIT,
  derivePublishOverview,
  publishOverviewQueryParams,
  validatePublishOverviewArgs,
} from "./publishOverview";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";
const A4 = "0b5c1e2a-2000-4000-8000-000000000004";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function asset(
  id: string,
  projectId: string,
  receipt?: Metadata,
  status: AssetStatus = "ready",
): Asset {
  return {
    id,
    project_id: projectId,
    type: "video",
    name: `asset-${id}`,
    status,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    version: 1,
    tags: [],
    storage: { key: `assets/${id}.mp4`, size_bytes: 1024, content_type: "video/mp4" },
    created_at: "2026-03-18T08:00:00.000Z",
    updated_at: "2026-03-18T08:00:00.000Z",
    ...(receipt !== undefined ? { metadata: { publish_receipt: receipt } } : {}),
  };
}

function receipt(version: number, sizeBytes: number, publishedAt: string): Metadata {
  return { version, size_bytes: sizeBytes, published_at: publishedAt };
}

const ASSETS: readonly Asset[] = [
  asset(A1, P1, receipt(1, 100, "2026-03-18T08:00:00.000Z")),
  asset(A2, P1, receipt(2, 200, "2026-03-18T09:00:00.000Z")),
  asset(A3, P1, receipt(3, 300, "2026-03-18T07:00:00.000Z")),
  asset(A4, P2, receipt(1, 400, "2026-03-18T10:00:00.000Z")),
];

const SEEDS = { assets: ASSETS, projects: PROJECTS, now: NOW };

describe("derivePublishOverview", () => {
  it("derives identity, joined project, whole-scope counts and newest-first siblings", () => {
    const overview = derivePublishOverview(A1, SEEDS);

    expect(overview).toMatchObject({
      asset_id: A1,
      asset_name: `asset-${A1}`,
      asset_type: "video",
      project_id: P1,
      project_name: "Moonshot",
      version: 1,
      size_bytes: 100,
      published_at: "2026-03-18T08:00:00.000Z",
      counts: {
        project_published: 3,
        project_bytes: 600,
        total_published: 4,
      },
      generated_at: NOW,
    });
    // Siblings are same-project, newest-first, and include the target.
    expect(overview.recent_siblings?.map((item) => item.asset_id)).toEqual([A2, A1, A3]);
    expect(overview.recent_siblings?.[0]).toMatchObject({
      project_name: "Moonshot",
      size_bytes: 200,
    });
  });

  it("bounds the sibling page by recentLimit without bounding the counts", () => {
    const overview = derivePublishOverview(A1, SEEDS, { recentLimit: 1 });

    expect(overview.recent_siblings).toHaveLength(1);
    expect(overview.recent_siblings?.[0]?.asset_id).toBe(A2);
    expect(overview.counts.project_published).toBe(3);
    expect(overview.counts.total_published).toBe(4);
  });

  it("uses the unknown-project fallback for an orphan asset", () => {
    const orphan = asset(A1, "00000000-0000-4000-8000-000000000000", receipt(1, 10, NOW));
    const overview = derivePublishOverview(A1, { ...SEEDS, assets: [orphan] });

    expect(overview.project_name).toBe(UNKNOWN_PROJECT_NAME);
    expect(overview.counts.project_published).toBe(1);
    expect(overview.recent_siblings?.[0]?.project_name).toBe(UNKNOWN_PROJECT_NAME);
  });

  it("throws an asset_not_found 404 for an unknown asset", () => {
    try {
      derivePublishOverview("00000000-0000-4000-8000-000000000000", SEEDS);
      throw new Error("expected derivation to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect(cause).toMatchObject({ status: 404, code: "asset_not_found" });
    }
  });

  it.each([
    ["a missing receipt", asset(A1, P1)],
    ["a malformed receipt", asset(A1, P1, { version: true, size_bytes: 10, published_at: NOW })],
    ["a soft-deleted asset", asset(A1, P1, receipt(1, 10, NOW), "deleted")],
  ])("throws a publish_not_found 404 for %s", (_label, target) => {
    try {
      derivePublishOverview(A1, { ...SEEDS, assets: [target] });
      throw new Error("expected derivation to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect(cause).toMatchObject({ status: 404, code: "publish_not_found" });
    }
  });
});

describe("validatePublishOverviewArgs", () => {
  it("accepts a valid id and default options", () => {
    expect(() => validatePublishOverviewArgs(A1)).not.toThrow();
    expect(() =>
      validatePublishOverviewArgs(A1, { recentLimit: DEFAULT_PUBLISH_OVERVIEW_RECENT_LIMIT }),
    ).not.toThrow();
  });

  it.each(["not-a-uuid", "oops"])("rejects a malformed asset id (%s)", (assetId) => {
    expect(() => validatePublishOverviewArgs(assetId)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validatePublishOverviewArgs(A1, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("publishOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(publishOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(publishOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
