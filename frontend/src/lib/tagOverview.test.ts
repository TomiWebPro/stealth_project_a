import { describe, expect, it } from "vitest";

import type { Asset, AssetStatus, Project } from "./types";
import {
  DEFAULT_TAG_OVERVIEW_RECENT_LIMIT,
  deriveTagOverview,
  tagOverviewQueryParams,
  UNKNOWN_ASSET_PROJECT_NAME,
  validateTagOverviewArgs,
} from "./tagOverview";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const UNKNOWN = "00000000-0000-4000-8000-000000000000";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";
const A4 = "0b5c1e2a-2000-4000-8000-000000000004";
const A5 = "0b5c1e2a-2000-4000-8000-000000000005";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function asset(
  id: string,
  projectId: string,
  tags: string[],
  createdAt: string,
  status: AssetStatus = "ready",
): Asset {
  return {
    id,
    project_id: projectId,
    type: "lora",
    name: `asset-${id}`,
    status,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    version: 1,
    tags,
    storage: { key: `assets/${id}.safetensors`, size_bytes: 1024, content_type: "application/octet-stream" },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const ASSETS: readonly Asset[] = [
  asset(A1, P1, ["lora", "character"], "2026-03-18T08:00:00.000Z"),
  asset(A2, P1, ["lora", "prop"], "2026-03-18T09:00:00.000Z"),
  asset(A3, P1, ["lora", "environment"], "2026-03-18T07:00:00.000Z"),
  asset(A4, P2, ["lora"], "2026-03-18T10:00:00.000Z"),
  asset(A5, P1, ["other"], "2026-03-18T11:00:00.000Z"),
  asset(A1, P1, ["lora"], "2026-03-18T12:00:00.000Z", "deleted"),
];

const SEEDS = { assets: ASSETS, projects: PROJECTS, now: NOW };

describe("deriveTagOverview", () => {
  it("derives identity, whole-scope counts and a newest-first tagged-asset page", () => {
    const overview = deriveTagOverview("lora", SEEDS);

    expect(overview).toMatchObject({
      tag: "lora",
      project_id: null,
      project_name: null,
      counts: {
        tagged_assets: 4,
        tagged_projects: 2,
        scope_assets: 5,
      },
      generated_at: NOW,
    });
    expect(overview.recent_assets?.map((item) => item.asset_id)).toEqual([A4, A2, A1, A3]);
    expect(overview.recent_assets?.[0]).toMatchObject({
      project_id: P2,
      project_name: "Brand Film",
      size_bytes: 1024,
    });
  });

  it("scopes the snapshot to one project, joining its name and bounded counts", () => {
    const overview = deriveTagOverview("lora", SEEDS, { projectId: P1 });

    expect(overview).toMatchObject({
      project_id: P1,
      project_name: "Moonshot",
      counts: {
        tagged_assets: 3,
        tagged_projects: 1,
        scope_assets: 4,
      },
    });
    expect(overview.recent_assets?.map((item) => item.asset_id)).toEqual([A2, A1, A3]);
    expect(overview.recent_assets?.every((item) => item.project_name === "Moonshot")).toBe(true);
  });

  it("bounds the recent page by recentLimit without bounding the counts", () => {
    const overview = deriveTagOverview("lora", SEEDS, { recentLimit: 2 });

    expect(overview.recent_assets).toHaveLength(2);
    expect(overview.recent_assets?.map((item) => item.asset_id)).toEqual([A4, A2]);
    expect(overview.counts.tagged_assets).toBe(4);
  });

  it("uses the unknown-project fallback for an orphan tagged asset", () => {
    const orphan = asset(A1, UNKNOWN, ["lora"], "2026-03-18T08:00:00.000Z");
    const overview = deriveTagOverview("lora", { ...SEEDS, assets: [orphan] });

    expect(overview.recent_assets?.[0]?.project_name).toBe(UNKNOWN_ASSET_PROJECT_NAME);
    expect(overview.counts.tagged_projects).toBe(1);
  });

  it("matches tags exactly and case-sensitively", () => {
    const mixed = [asset(A1, P1, ["LoRa"], "2026-03-18T08:00:00.000Z")];
    expect(() => deriveTagOverview("lora", { ...SEEDS, assets: mixed })).toThrowError(
      expect.objectContaining({ status: 404, code: "tag_not_found" }),
    );
  });

  it("throws a tag_not_found 404 when no live asset carries the tag", () => {
    expect(() => deriveTagOverview("missing", SEEDS)).toThrowError(
      expect.objectContaining({ status: 404, code: "tag_not_found" }),
    );
  });

  it("throws a project_not_found 404 for an unknown project scope", () => {
    expect(() => deriveTagOverview("lora", SEEDS, { projectId: UNKNOWN })).toThrowError(
      expect.objectContaining({ status: 404, code: "project_not_found" }),
    );
  });
});

describe("validateTagOverviewArgs", () => {
  it("accepts a valid tag and default options", () => {
    expect(() => validateTagOverviewArgs("lora")).not.toThrow();
    expect(() =>
      validateTagOverviewArgs("lora", {
        recentLimit: DEFAULT_TAG_OVERVIEW_RECENT_LIMIT,
        projectId: P1,
      }),
    ).not.toThrow();
  });

  it.each(["", "   "])("rejects an empty tag (%s)", (tag) => {
    expect(() => validateTagOverviewArgs(tag)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("rejects a malformed project id", () => {
    expect(() => validateTagOverviewArgs("lora", { projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateTagOverviewArgs("lora", { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("tagOverviewQueryParams", () => {
  it("maps the scope and recent limit to the live query params", () => {
    expect(tagOverviewQueryParams()).toEqual({ project_id: undefined, recent_limit: undefined });
    expect(tagOverviewQueryParams({ projectId: P1, recentLimit: 2 })).toEqual({
      project_id: P1,
      recent_limit: 2,
    });
  });
});
