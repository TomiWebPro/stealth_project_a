import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { UNKNOWN_LINEAGE_ASSET_NAME } from "./lineageFeed";
import type { AssetRelationshipRecord } from "./lineageStats";
import type { Asset, Project } from "./types";
import {
  DEFAULT_LINEAGE_OVERVIEW_RECENT_LIMIT,
  deriveLineageOverview,
  lineageOverviewQueryParams,
  validateLineageOverviewArgs,
} from "./lineageOverview";

const REL_ID = "0b5c1e2a-5000-4000-8000-000000000001";
const SRC_ID = "0b5c1e2a-2000-4000-8000-000000000012";
const TGT_ID = "0b5c1e2a-2000-4000-8000-000000000011";
const OTHER_ID = "0b5c1e2a-2000-4000-8000-000000000013";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const NOW = "2026-03-18T10:30:00.000Z";

function asset(id: string, name: string, type: Asset["type"], options: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: PROJECT_ID,
    type,
    name,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    storage: { key: `${id}.bin`, size_bytes: 1, content_type: "application/octet-stream" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...options,
  };
}

function rel(
  id: string,
  from: string,
  to: string,
  type: AssetRelationshipRecord["type"],
  created_at: string,
): AssetRelationshipRecord {
  return { id, from_asset_id: from, to_asset_id: to, type, created_at };
}

const seeds = {
  relationships: [
    rel(REL_ID, SRC_ID, TGT_ID, "derived_from", "2026-03-10T00:00:00.000Z"),
    rel("0b5c1e2a-5000-4000-8000-000000000002", SRC_ID, OTHER_ID, "uses_input", "2026-03-12T00:00:00.000Z"),
    rel("0b5c1e2a-5000-4000-8000-000000000003", OTHER_ID, SRC_ID, "variant_of", "2026-03-11T00:00:00.000Z"),
    rel("0b5c1e2a-5000-4000-8000-000000000004", OTHER_ID, TGT_ID, "related_to", "2026-03-09T00:00:00.000Z"),
  ],
  assets: [
    asset(SRC_ID, "Source frame", "image"),
    asset(TGT_ID, "Concept frame", "image"),
    asset(OTHER_ID, "Dataset", "dataset"),
  ],
  projects: [{ id: PROJECT_ID, name: "Moonshot" } as Project],
  now: NOW,
};

describe("deriveLineageOverview", () => {
  it("derives endpoint identity, joined names and whole-source-asset counts", () => {
    const overview = deriveLineageOverview(REL_ID, seeds);

    expect(overview).toMatchObject({
      id: REL_ID,
      from_asset_id: SRC_ID,
      to_asset_id: TGT_ID,
      from_asset_name: "Source frame",
      to_asset_name: "Concept frame",
      from_asset_type: "image",
      to_asset_type: "image",
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      type: "derived_from",
      created_at: "2026-03-10T00:00:00.000Z",
      counts: {
        source_upstream: 1,
        source_downstream: 2,
        source_types: 3,
        project_relationships: 4,
      },
      generated_at: NOW,
    });
    // The sibling page holds only source-downstream links, newest first.
    expect(overview.recent_relationships?.map((item) => item.id)).toEqual([
      "0b5c1e2a-5000-4000-8000-000000000002",
      REL_ID,
    ]);
    expect(overview.recent_relationships?.[0]).toMatchObject({
      from_asset_name: "Source frame",
      to_asset_name: "Dataset",
      project_name: "Moonshot",
    });
  });

  it("uses stable fallbacks for a missing target and a missing project", () => {
    const overview = deriveLineageOverview(REL_ID, {
      ...seeds,
      assets: [asset(SRC_ID, "Source frame", "image")],
      projects: [],
    });

    expect(overview.to_asset_name).toBe(UNKNOWN_LINEAGE_ASSET_NAME);
    expect(overview.to_asset_type).toBeNull();
    expect(overview.project_name).toBe("Unknown project");
    expect(overview.recent_relationships?.[0]?.to_asset_name).toBe(UNKNOWN_LINEAGE_ASSET_NAME);
    expect(overview.recent_relationships?.[0]?.project_name).toBe("Unknown project");
  });

  it("excludes soft-deleted/unknown sources from the canonical set (404)", () => {
    const deletedSource = {
      ...seeds,
      assets: seeds.assets.map((item) =>
        item.id === SRC_ID ? { ...item, status: "deleted" as const } : item,
      ),
    };
    expect(() => deriveLineageOverview(REL_ID, deletedSource)).toThrowError(ApiError);
    try {
      deriveLineageOverview(REL_ID, deletedSource);
    } catch (cause) {
      expect(cause).toMatchObject({ status: 404, code: "relationship_not_found" });
    }
  });

  it("bounds the sibling page by recentLimit without bounding the counts", () => {
    const overview = deriveLineageOverview(REL_ID, seeds, { recentLimit: 1 });

    expect(overview.recent_relationships).toHaveLength(1);
    expect(overview.recent_relationships?.[0]?.id).toBe("0b5c1e2a-5000-4000-8000-000000000002");
    expect(overview.counts.source_downstream).toBe(2);
    expect(overview.counts.project_relationships).toBe(4);
  });
});

describe("validateLineageOverviewArgs", () => {
  it("accepts a valid id and the default options", () => {
    expect(() => validateLineageOverviewArgs(REL_ID)).not.toThrow();
    expect(() =>
      validateLineageOverviewArgs(REL_ID, { recentLimit: DEFAULT_LINEAGE_OVERVIEW_RECENT_LIMIT }),
    ).not.toThrow();
  });

  it.each(["not-a-uuid", "oops"])("rejects a malformed relationship id (%s)", (id) => {
    expect(() => validateLineageOverviewArgs(id)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateLineageOverviewArgs(REL_ID, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("lineageOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(lineageOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(lineageOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
