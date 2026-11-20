import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { AssetVersionFeedRecord } from "./versionFeed";
import type { Asset, Project } from "./types";
import {
  UNKNOWN_VERSION_OVERVIEW_PROJECT_NAME,
  deriveVersionOverview,
  validateVersionOverviewArgs,
  versionOverviewQueryParams,
} from "./versionOverview";

const ASSET_ID = "0b5c1e2a-2000-4000-8000-000000000001";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const NOW = "2026-03-18T10:30:00.000Z";

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: ASSET_ID,
    project_id: PROJECT_ID,
    type: "image",
    name: "concept_frame",
    status: "ready",
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    version: 2,
    storage: {
      key: "Publish/Projects/Default/Assets/Char/concept_frame.v2.png",
      size_bytes: 1_200_000,
      content_type: "image/png",
    },
    created_at: "2026-03-10T10:30:00.000Z",
    updated_at: "2026-03-17T10:30:00.000Z",
    ...overrides,
  };
}

function project(id: string, name: string): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function versionRecord(overrides: Partial<AssetVersionFeedRecord> = {}): AssetVersionFeedRecord {
  return {
    asset_id: ASSET_ID,
    version: 1,
    created_at: "2026-03-10T10:30:00.000Z",
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    ...overrides,
  };
}

function seeds(overrides: Partial<Parameters<typeof deriveVersionOverview>[2]> = {}) {
  return {
    projects: [project(PROJECT_ID, "Moonshot")],
    assets: [asset()],
    assetVersions: [versionRecord(), versionRecord({ version: 2, created_at: "2026-03-17T10:30:00.000Z" })],
    now: NOW,
    ...overrides,
  };
}

describe("deriveVersionOverview", () => {
  it("derives identity, joined project, storage and whole-asset counts for the latest version", () => {
    const overview = deriveVersionOverview(ASSET_ID, 2, seeds());

    expect(overview).toEqual({
      asset_id: ASSET_ID,
      asset_name: "concept_frame",
      asset_type: "image",
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      version: 2,
      storage: asset().storage,
      created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
      created_at: "2026-03-17T10:30:00.000Z",
      is_latest: true,
      counts: { asset_versions: 2, revisions: 1 },
      recent_versions: [
        { ...versionRecord({ version: 2, created_at: "2026-03-17T10:30:00.000Z" }), storage: asset().storage },
        { ...versionRecord(), storage: asset().storage },
      ],
      generated_at: NOW,
    });
  });

  it("flags a non-latest version and keeps counts unbounded by the page", () => {
    const overview = deriveVersionOverview(ASSET_ID, 1, seeds(), { recentLimit: 1 });

    expect(overview.version).toBe(1);
    expect(overview.is_latest).toBe(false);
    expect(overview.counts).toEqual({ asset_versions: 2, revisions: 1 });
    expect(overview.recent_versions).toHaveLength(1);
    expect(overview.recent_versions?.[0]?.version).toBe(2);
  });

  it("uses a stable fallback for an orphan project", () => {
    const overview = deriveVersionOverview(ASSET_ID, 1, seeds({ projects: [] }));
    expect(overview.project_name).toBe(UNKNOWN_VERSION_OVERVIEW_PROJECT_NAME);
  });

  it("throws a normalized 404 for an unknown asset and an unknown version", () => {
    expect(() => deriveVersionOverview("missing", 1, seeds())).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "asset_not_found" }),
    );
    expect(() => deriveVersionOverview(ASSET_ID, 9, seeds())).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "version_not_found" }),
    );
    expect(() => deriveVersionOverview(ASSET_ID, 9, seeds())).toThrow(ApiError);
  });
});

describe("validateVersionOverviewArgs", () => {
  it("accepts a well-formed id, version and limit", () => {
    expect(() => validateVersionOverviewArgs(ASSET_ID, 2, { recentLimit: 5 })).not.toThrow();
  });

  it("rejects a malformed asset id, version or recent limit with the shared 422 envelope", () => {
    for (const [id, version, options] of [
      ["not-a-uuid", 1, {}],
      [ASSET_ID, 0, {}],
      [ASSET_ID, 1.5, {}],
      [ASSET_ID, 1, { recentLimit: 0 }],
      [ASSET_ID, 1, { recentLimit: 51 }],
    ] as const) {
      expect(() => validateVersionOverviewArgs(id, version, options)).toThrow(
        expect.objectContaining({ name: "ApiError", status: 422, code: "validation_error" }),
      );
    }
  });
});

describe("versionOverviewQueryParams", () => {
  it("emits only the recent limit bound", () => {
    expect(versionOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(versionOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });
});
