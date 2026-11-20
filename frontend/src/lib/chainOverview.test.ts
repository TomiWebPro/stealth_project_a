import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { Asset, Job, Project } from "./types";
import type { PipelineChainRecord } from "./pipelineStats";
import {
  DEFAULT_CHAIN_OVERVIEW_RECENT_LIMIT,
  UNKNOWN_CHAIN_OVERVIEW_PROJECT_NAME,
  chainOverviewQueryParams,
  deriveChainOverview,
  validateChainOverviewArgs,
} from "./chainOverview";
import type { ChainOverviewSeeds } from "./chainOverview";

const CHAIN_ID = "0b5c1e2a-4000-4000-8000-000000000001";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";
const JOB_A = "0b5c1e2a-3000-4000-8000-000000000011";
const JOB_B = "0b5c1e2a-3000-4000-8000-000000000012";
const ASSET_A = "0b5c1e2a-2000-4000-8000-000000000012";
const ASSET_B = "0b5c1e2a-2000-4000-8000-000000000013";
const ASSET_C = "0b5c1e2a-2000-4000-8000-000000000015";

function project(id: string, name: string): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function job(id: string, createdAt: string): Job {
  return {
    id,
    project_id: PROJECT_ID,
    operation_id: "lora-train",
    schema_version: "1.0.0",
    status: "succeeded",
    created_by: CREATOR,
    created_at: createdAt,
  };
}

function asset(id: string, createdAt: string, status: Asset["status"] = "ready"): Asset {
  return {
    id,
    project_id: PROJECT_ID,
    type: "image",
    name: `asset-${id}`,
    status,
    creator_id: CREATOR,
    storage: { key: `assets/${id}`, size_bytes: 100, content_type: "image/png" },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function chain(overrides: Partial<PipelineChainRecord> = {}): PipelineChainRecord {
  return {
    id: CHAIN_ID,
    kind: "training",
    project_id: PROJECT_ID,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    job_ids: [JOB_A, JOB_B],
    dataset_asset_id: ASSET_A,
    config_asset_id: ASSET_B,
    lora_asset_id: ASSET_C,
    ...overrides,
  };
}

function seeds(overrides: Partial<ChainOverviewSeeds> = {}): ChainOverviewSeeds {
  return {
    chains: [chain()],
    jobs: [job(JOB_A, "2026-01-02T00:00:00.000Z"), job(JOB_B, "2026-01-03T00:00:00.000Z")],
    assets: [
      asset(ASSET_A, "2026-01-04T00:00:00.000Z"),
      asset(ASSET_B, "2026-01-05T00:00:00.000Z"),
      asset(ASSET_C, "2026-01-06T00:00:00.000Z"),
    ],
    projects: [project(PROJECT_ID, "Moonshot")],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

describe("deriveChainOverview", () => {
  it("derives identity, whole-scope counts and newest-first bounded recent lists", () => {
    const overview = deriveChainOverview(CHAIN_ID, seeds(), { recentLimit: 2 });

    expect(overview).toEqual({
      chain_id: CHAIN_ID,
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      kind: "training",
      created_by: CREATOR,
      created_at: "2026-01-01T00:00:00.000Z",
      counts: { jobs: 2, assets: 3 },
      recent_jobs: [
        {
          job_id: JOB_B,
          operation_id: "lora-train",
          status: "succeeded",
          created_at: "2026-01-03T00:00:00.000Z",
        },
        {
          job_id: JOB_A,
          operation_id: "lora-train",
          status: "succeeded",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      recent_assets: [
        {
          asset_id: ASSET_C,
          name: `asset-${ASSET_C}`,
          asset_type: "image",
          created_at: "2026-01-06T00:00:00.000Z",
        },
        {
          asset_id: ASSET_B,
          name: `asset-${ASSET_B}`,
          asset_type: "image",
          created_at: "2026-01-05T00:00:00.000Z",
        },
      ],
      generated_at: REFERENCE_NOW,
    });
  });

  it("defaults the recent limit to five", () => {
    expect(deriveChainOverview(CHAIN_ID, seeds()).recent_jobs).toHaveLength(2);
    expect(DEFAULT_CHAIN_OVERVIEW_RECENT_LIMIT).toBe(5);
  });

  it("skips orphan jobs and soft-deleted/missing assets without shrinking counts", () => {
    const overview = deriveChainOverview(
      CHAIN_ID,
      seeds({
        jobs: [job(JOB_A, "2026-01-02T00:00:00.000Z")],
        assets: [
          asset(ASSET_A, "2026-01-04T00:00:00.000Z"),
          asset(ASSET_B, "2026-01-05T00:00:00.000Z", "deleted"),
        ],
      }),
    );

    expect(overview.counts).toEqual({ jobs: 2, assets: 3 });
    expect(overview.recent_jobs?.map((ref) => ref.job_id)).toEqual([JOB_A]);
    expect(overview.recent_assets?.map((ref) => ref.asset_id)).toEqual([ASSET_A]);
  });

  it("uses the stable unknown-project fallback and tolerates a bare chain", () => {
    const overview = deriveChainOverview(
      CHAIN_ID,
      seeds({
        chains: [chain({ job_ids: undefined, job_id: null, project_id: "missing-project" })],
        jobs: [],
        assets: [],
        projects: [],
      }),
    );

    expect(overview.project_name).toBe(UNKNOWN_CHAIN_OVERVIEW_PROJECT_NAME);
    expect(overview.counts).toEqual({ jobs: 0, assets: 3 });
    expect(overview.recent_jobs).toEqual([]);
    expect(overview.recent_assets).toEqual([]);
  });

  it("supports a single job_id chain and de-duplicates linked asset fields", () => {
    const overview = deriveChainOverview(
      CHAIN_ID,
      seeds({
        chains: [chain({ job_ids: undefined, job_id: JOB_A, config_asset_id: ASSET_A })],
      }),
    );
    expect(overview.counts.jobs).toBe(1);
    expect(overview.recent_jobs?.map((ref) => ref.job_id)).toEqual([JOB_A]);
    // The same asset id referenced by two fields is projected once.
    expect(overview.recent_assets?.map((ref) => ref.asset_id)).toEqual([ASSET_C, ASSET_A]);
  });

  it("throws a normalized 404 for an unknown chain", () => {
    expect(() => deriveChainOverview("missing", seeds())).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "chain_not_found" }),
    );
    expect(() => deriveChainOverview("missing", seeds())).toThrow(ApiError);
  });
});

describe("validateChainOverviewArgs / chainOverviewQueryParams", () => {
  it("rejects a malformed chain id with the shared 422 envelope", () => {
    expect(() => validateChainOverviewArgs("not-a-uuid")).toThrow(
      expect.objectContaining({
        name: "ApiError",
        status: 422,
        code: "validation_error",
      }),
    );
  });

  it("rejects out-of-range recent limits with the shared 422 envelope", () => {
    for (const recentLimit of [0, 51, 1.5]) {
      expect(() => validateChainOverviewArgs(CHAIN_ID, { recentLimit })).toThrow(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    }
    expect(() => validateChainOverviewArgs(CHAIN_ID, { recentLimit: 5 })).not.toThrow();
    expect(() => validateChainOverviewArgs(CHAIN_ID)).not.toThrow();
  });

  it("forwards the recent limit as a query parameter", () => {
    expect(chainOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(chainOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
