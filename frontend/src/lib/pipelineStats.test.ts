import { describe, expect, it } from "vitest";

import {
  derivePipelineStats,
  PIPELINE_KINDS,
  pipelineStatsQueryParams,
  validatePipelineStatsArgs,
} from "./pipelineStats";
import type { PipelineChainRecord } from "./pipelineStats";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";

function chain(
  id: string,
  kind: "training" | "shot" | "splat",
  projectId: string,
  createdAt: string,
  overrides: Partial<PipelineChainRecord> = {},
): PipelineChainRecord {
  return { id, kind, project_id: projectId, created_at: createdAt, ...overrides };
}

const TRAINING = chain("0b5c1e2a-4000-4000-8000-000000000001", "training", P1, "2026-03-18T07:30:00.000Z", {
  dataset_asset_id: "a1",
  config_asset_id: "a2",
  lora_asset_id: "a3",
  job_ids: ["j1", "j2"],
});
const SHOT = chain("0b5c1e2a-4000-4000-8000-000000000002", "shot", P1, "2026-03-18T08:30:00.000Z", {
  job_id: "j3",
  video_asset_id: "a4",
});
const SPLAT = chain("0b5c1e2a-4000-4000-8000-000000000003", "splat", P2, NOW, {
  scene_asset_id: "a5",
  model_asset_id: "a6",
  splat_asset_id: "a7",
  job_ids: ["j4", "j5"],
});

describe("derivePipelineStats", () => {
  it("zero-fills every kind bucket for an empty chain set", () => {
    expect(derivePipelineStats([], NOW)).toEqual({
      total_chains: 0,
      total_jobs: 0,
      total_assets: 0,
      by_kind: PIPELINE_KINDS.map((kind) => ({ kind, chains: 0, jobs: 0, assets: 0 })),
      by_project: [],
      newest_chain_at: null,
      generated_at: NOW,
    });
  });

  it("derives totals, per-kind and per-project breakdowns and recency", () => {
    // Unsorted input proves the derivation does not depend on store order.
    const stats = derivePipelineStats([SPLAT, TRAINING, SHOT], NOW);
    expect(stats.total_chains).toBe(3);
    expect(stats.total_jobs).toBe(5);
    expect(stats.total_assets).toBe(7);
    expect(stats.by_kind).toEqual([
      { kind: "training", chains: 1, jobs: 2, assets: 3 },
      { kind: "shot", chains: 1, jobs: 1, assets: 1 },
      { kind: "splat", chains: 1, jobs: 2, assets: 3 },
    ]);
    // Most chains first, then project id for a deterministic tie-break.
    expect(stats.by_project).toEqual([
      { project_id: P1, chains: 2 },
      { project_id: P2, chains: 1 },
    ]);
    expect(stats.newest_chain_at).toBe(NOW);
    expect(stats.generated_at).toBe(NOW);
  });

  it("counts a single job_id and ignores null asset fields", () => {
    const stats = derivePipelineStats(
      [
        chain("id-null", "training", P1, NOW, {
          dataset_asset_id: "a1",
          config_asset_id: null,
          lora_asset_id: undefined,
          job_id: "j1",
        }),
      ],
      NOW,
    );
    expect(stats.by_kind?.[0]).toEqual({ kind: "training", chains: 1, jobs: 1, assets: 1 });
    expect(stats.total_jobs).toBe(1);
    expect(stats.total_assets).toBe(1);
  });

  it("is deterministic under input reordering, including recency ties", () => {
    const lower = chain("00000000-0000-4000-8000-000000000001", "shot", P1, NOW, { job_id: "j" });
    const higher = chain("00000000-0000-4000-8000-000000000002", "shot", P1, NOW, { job_id: "j" });
    expect(derivePipelineStats([lower, higher], NOW).newest_chain_at).toBe(NOW);
    // Both chains share created_at; the (created_at, id) tie-break keeps the
    // snapshot identical regardless of store iteration order.
    expect(derivePipelineStats([higher, lower], NOW)).toEqual(
      derivePipelineStats([lower, higher], NOW),
    );
  });

  it("scopes the derivation to one project without mutating the global seed", () => {
    const scoped = derivePipelineStats([TRAINING, SHOT, SPLAT], NOW, { projectId: P2 });
    expect(scoped.total_chains).toBe(1);
    expect(scoped.by_kind).toEqual([
      { kind: "training", chains: 0, jobs: 0, assets: 0 },
      { kind: "shot", chains: 0, jobs: 0, assets: 0 },
      { kind: "splat", chains: 1, jobs: 2, assets: 3 },
    ]);
    expect(scoped.by_project).toEqual([{ project_id: P2, chains: 1 }]);

    // A valid but unseeded project yields the zero-filled empty snapshot.
    const empty = derivePipelineStats([TRAINING, SHOT, SPLAT], NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_chains).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_chain_at).toBeNull();
  });
});

describe("pipeline stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validatePipelineStatsArgs()).not.toThrow();
    expect(() => validatePipelineStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validatePipelineStatsArgs({ projectId: "not-a-uuid" });
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
    expect(pipelineStatsQueryParams()).toEqual({ project_id: undefined });
    expect(pipelineStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
