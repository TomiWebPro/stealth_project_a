import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { PipelineChainRecord } from "./pipelineStats";
import {
  derivePipelineFeed,
  pipelineFeedQueryParams,
  validatePipelineFeedArgs,
} from "./pipelineFeed";

const NOW = "2026-11-19T12:00:00Z";

const projects = [
  { id: "project-training", name: "Training Project" },
  { id: "project-shot", name: "Shot Project" },
];

function chain(
  id: string,
  overrides: Partial<PipelineChainRecord> = {},
): PipelineChainRecord {
  return {
    id,
    kind: "training",
    project_id: "project-training",
    created_by: "creator-1",
    created_at: "2026-01-01T00:00:00Z",
    job_ids: ["job-1", "job-2"],
    dataset_asset_id: "asset-dataset",
    ...overrides,
  };
}

const chains: PipelineChainRecord[] = [
  chain("chain-old", { created_at: "2026-01-02T00:00:00Z", kind: "training" }),
  chain("chain-new", {
    created_at: "2026-01-05T00:00:00Z",
    kind: "shot",
    project_id: "project-shot",
    job_ids: null,
    dataset_asset_id: null,
    job_id: "job-3",
    video_asset_id: "asset-video",
  }),
  chain("chain-mid", { created_at: "2026-01-03T00:00:00Z", kind: "splat", job_ids: ["job-4"] }),
  chain("chain-unknown-project", {
    created_at: "2026-01-04T00:00:00Z",
    project_id: "missing-project",
  }),
];

describe("derivePipelineFeed", () => {
  it("projects chains newest-first with joined names, counts and provenance", () => {
    const feed = derivePipelineFeed(chains, projects, NOW);
    expect(feed.total).toBe(4);
    expect((feed.items ?? []).map((item) => item.chain_id)).toEqual([
      "chain-new",
      "chain-unknown-project",
      "chain-mid",
      "chain-old",
    ]);
    expect(feed.items?.[0]).toMatchObject({
      chain_id: "chain-new",
      project_id: "project-shot",
      project_name: "Shot Project",
      kind: "shot",
      job_count: 1,
      asset_count: 1,
      created_by: "creator-1",
      created_at: "2026-01-05T00:00:00Z",
    });
    expect(feed.items?.find((item) => item.chain_id === "chain-old")).toMatchObject({
      job_count: 2,
      asset_count: 1,
      project_name: "Training Project",
    });
    expect(feed.generated_at).toBe(NOW);
  });

  it("uses a stable 'Unknown project' name for a missing project", () => {
    const feed = derivePipelineFeed(chains, projects, NOW);
    expect(feed.items?.find((item) => item.chain_id === "chain-unknown-project")?.project_name).toBe(
      "Unknown project",
    );
  });

  it("breaks creation-time ties deterministically by chain id", () => {
    const tied = [chain("b"), chain("a")].map((value) => ({
      ...value,
      created_at: "2026-01-05T00:00:00Z",
    }));
    const feed = derivePipelineFeed(tied, projects, NOW);
    const ids = (feed.items ?? []).map((item) => item.chain_id);
    expect(ids).toEqual([...ids].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0)));
  });

  it("filters by kind and project independently", () => {
    expect(derivePipelineFeed(chains, projects, NOW, { kind: "shot" }).total).toBe(1);
    expect(derivePipelineFeed(chains, projects, NOW, { projectId: "project-training" }).total).toBe(2);
    const both = derivePipelineFeed(chains, projects, NOW, {
      kind: "training",
      projectId: "project-training",
    });
    expect(both.total).toBe(1);
    expect(derivePipelineFeed(chains, projects, NOW, { kind: "splat", projectId: "project-shot" }).total).toBe(0);
  });

  it("bounds the page with a whole-scope total counted before paging", () => {
    const feed = derivePipelineFeed(chains, projects, NOW, { limit: 2 });
    expect(feed.total).toBe(4);
    expect(feed.items ?? []).toHaveLength(2);
  });

  it("returns an empty feed for an empty store", () => {
    expect(derivePipelineFeed([], projects, NOW)).toEqual({ items: [], total: 0, generated_at: NOW });
  });
});

describe("validatePipelineFeedArgs", () => {
  it("accepts empty options and well-formed filters and limits", () => {
    expect(() => validatePipelineFeedArgs()).not.toThrow();
    expect(() =>
      validatePipelineFeedArgs({
        projectId: "0b5c1e2a-1000-4000-8000-000000000001",
        kind: "training",
        limit: 200,
      }),
    ).not.toThrow();
  });

  it("rejects a malformed project id with a 422", () => {
    expect(() => validatePipelineFeedArgs({ projectId: "not-a-uuid" })).toThrowError(ApiError);
    try {
      validatePipelineFeedArgs({ projectId: "not-a-uuid" });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it("rejects an unknown kind with a 422", () => {
    expect(() => validatePipelineFeedArgs({ kind: "mystery" as never })).toThrowError(ApiError);
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validatePipelineFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("pipelineFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(
      pipelineFeedQueryParams({
        projectId: "project-1",
        kind: "shot",
        limit: 5,
      }),
    ).toEqual({ project_id: "project-1", kind: "shot", limit: 5 });
    expect(pipelineFeedQueryParams()).toEqual({
      project_id: undefined,
      kind: undefined,
      limit: undefined,
    });
  });
});
