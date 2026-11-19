/**
 * Authoritative production-pipeline feed derivation + query helpers (C177
 * follow-up).
 *
 * The backend (`PipelineFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed fresh from the three authoritative chain
 * collections — the same stores `/pipelines` lists and `/pipelines/stats`
 * aggregates — so the feed and the snapshot can never drift. Each chain is
 * projected with its canonical kind, joined project display name (missing
 * projects fall back to a stable "Unknown project"), and the same job/asset
 * counts `derivePipelineStats` uses. Ordering is by descending
 * `(created_at, chain_id)` for a deterministic wire shape, and `total` counts
 * the whole filtered feed before the `limit` page.
 *
 * `lib/pipelineFeed` reproduces that derivation over the same chain/project
 * seeds so mock mode stays at feature parity with live mode and the parity
 * guard can drive both transports over identical data. Invalid filter values
 * and page bounds use the shared 422 envelope, matching the router's query
 * validation, and an unknown `project_id` is normalized to a 404 by the fetch.
 */

import { ApiError } from "../api/client";
import type { PipelineKind, PipelineFeed, PipelineFeedItem } from "./types";
import { assetCount as pipelineAssetCount, jobCount as pipelineJobCount, PIPELINE_KINDS } from "./pipelineStats";
import type { PipelineChainRecord } from "./pipelineStats";

/** Optional scope/filters/page bound mirrored from the authoritative `/pipelines/feed` endpoint. */
export interface PipelineFeedOptions {
  readonly projectId?: string;
  readonly kind?: PipelineKind;
  readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const UNKNOWN_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id`, optional enum `kind` and
 * bounded `limit` validation so mock and live fail identically with the shared
 * error envelope. An unknown (but well-formed) project is checked against the
 * project seeds by the mock fetch and raises a normalized 404, matching
 * `projects.get_or_raise` on the backend.
 */
export function validatePipelineFeedArgs(options: PipelineFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.kind !== undefined && !PIPELINE_KINDS.includes(options.kind)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid pipeline kind.",
      details: [{ field: "kind", message: "kind must be one of training, shot, splat" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/** Python-compatible descending `(created_at, chain_id)` comparison. */
function compareNewest(a: PipelineFeedItem, b: PipelineFeedItem): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1;
  if (a.chain_id !== b.chain_id) return a.chain_id > b.chain_id ? -1 : 1;
  return 0;
}

/**
 * Derive the feed exactly as the backend repository does: filter the chain
 * seeds by kind/project, project each with its joined project name and the same
 * job/asset counts the stats derivation uses, sort newest-first with an id
 * tie-break and apply the `limit` page. `total` counts the whole filtered feed
 * before paging; an empty scope yields an empty feed (never an error).
 */
export function derivePipelineFeed(
  chains: readonly PipelineChainRecord[],
  projects: readonly { id: string; name: string }[],
  now: string,
  options: PipelineFeedOptions = {},
): PipelineFeed {
  const { limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const items: PipelineFeedItem[] = [];

  for (const chain of chains) {
    const kind = String(chain.kind);
    if (options.kind !== undefined && kind !== options.kind) continue;
    if (options.projectId !== undefined && chain.project_id !== options.projectId) continue;
    items.push({
      chain_id: chain.id,
      project_id: chain.project_id,
      project_name: projectNames.get(chain.project_id) ?? UNKNOWN_PROJECT_NAME,
      kind: kind as PipelineKind,
      job_count: pipelineJobCount(chain),
      asset_count: pipelineAssetCount(chain),
      created_by: String(chain.created_by ?? ""),
      created_at: chain.created_at,
    });
  }

  items.sort(compareNewest);
  return { items: items.slice(0, limit), total: items.length, generated_at: now };
}

/** Query-string values for the live `/pipelines/feed` request. */
export function pipelineFeedQueryParams(
  options: PipelineFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, kind: options.kind, limit: options.limit };
}
