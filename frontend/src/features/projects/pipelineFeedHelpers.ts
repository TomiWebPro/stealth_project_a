/**
 * Display models for the authoritative production-pipeline feed (C177/C179/
 * C180 follow-up). The backend derives the newest-first, workspace-wide feed
 * fresh from the three authoritative chain collections — the same stores
 * `/pipelines` lists and `/pipelines/stats` aggregates — and the mocks transport
 * mirrors that derivation. This module only turns the canonical `PipelineFeed`
 * payload into render-ready rows so the panel JSX stays free of inline mapping
 * and both transports render identically. Every helper tolerates `undefined`
 * (query not settled / failed) and returns render-safe values.
 */

import type { PipelineFeedOptions } from "../../lib/pipelineFeed";
import type { PipelineFeed, PipelineFeedItem, PipelineKind } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { pipelineKindLabel, pipelineKindTone } from "./pipelineStatsHelpers";

/** Render-ready row for one production pipeline chain in the feed. */
export interface PipelineFeedRow {
  readonly id: string;
  readonly chainId: string;
  readonly shortChainId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly kind: PipelineKind;
  readonly kindLabel: string;
  readonly kindTone: BadgeTone;
  readonly jobCount: number;
  readonly assetCount: number;
  readonly countsLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const PIPELINE_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Pipeline-kind chips; `undefined` is the unfiltered "All" chip. */
export const PIPELINE_FEED_KIND_FILTERS: readonly (PipelineKind | undefined)[] = [
  undefined,
  "training",
  "shot",
  "splat",
];

/** Hook query options from the active project/kind scope and page size. */
export function buildPipelineFeedOptions(
  projectId: string | undefined,
  kind: PipelineKind | undefined,
  limit: number,
): PipelineFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    ...(kind ? { kind } : {}),
    limit,
  };
}

/** Human label for a kind chip (`undefined` is the unfiltered "All" chip). */
export function pipelineFeedKindChipLabel(kind: PipelineKind | undefined): string {
  return kind ? pipelineKindLabel(kind) : "All";
}

/** Badge tone for a canonical pipeline kind (shared with the stats panel). */
export function pipelineFeedKindTone(kind: PipelineKind): BadgeTone {
  return pipelineKindTone(kind);
}

/** Short, stable fallback for a chain with no usable id. */
export function shortPipelineChainId(id: string | undefined): string {
  if (typeof id !== "string" || id === "") return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Stable fallback for a joined project name missing from the payload. */
export function pipelineFeedProjectName(name: string | undefined): string {
  return typeof name === "string" && name.trim() !== "" ? name : "Unknown project";
}

/** Defensive non-negative count for a possibly malformed feed field. */
function renderCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Compact "N jobs · M assets" label for a chain row. */
export function pipelineFeedCountsLabel(jobs: unknown, assets: unknown): string {
  const jobCount = renderCount(jobs);
  const assetCount = renderCount(assets);
  return `${jobCount} job${jobCount === 1 ? "" : "s"} · ${assetCount} asset${
    assetCount === 1 ? "" : "s"
  }`;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(created_at, chain_id)`).
 */
export function pipelineFeedRows(
  feed: PipelineFeed | undefined,
  now: number = Date.now(),
): readonly PipelineFeedRow[] {
  const items: readonly PipelineFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const jobCount = renderCount(item.job_count);
    const assetCount = renderCount(item.asset_count);
    const kind = item.kind;
    return {
      id: item.chain_id,
      chainId: item.chain_id,
      shortChainId: shortPipelineChainId(item.chain_id),
      projectId: item.project_id,
      projectName: pipelineFeedProjectName(item.project_name),
      kind,
      kindLabel: pipelineKindLabel(kind),
      kindTone: pipelineFeedKindTone(kind),
      jobCount,
      assetCount,
      countsLabel: pipelineFeedCountsLabel(jobCount, assetCount),
      timestamp: item.created_at,
      relativeTime: formatRelative(item.created_at, now),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all pipeline chains in scope before the `limit` page.
 */
export function pipelineFeedSummary(rows: readonly PipelineFeedRow[], total?: number): string {
  if (rows.length === 0) return "No pipeline chains";
  const count = renderCount(total ?? rows.length);
  const latest = rows[0];
  return `${count} chain${count === 1 ? "" : "s"} · latest: ${latest?.kindLabel ?? "—"} in ${
    latest?.projectName ?? "—"
  }`;
}

/** Compact "generated at" label for the feed footer. */
export function pipelineFeedGeneratedAtLabel(
  feed: PipelineFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope-aware empty-state copy for the feed. */
export function pipelineFeedEmptyDescription(filtered: boolean): string {
  return filtered
    ? "No pipeline chains match these filters. Try a different kind or a larger page size."
    : "Training, shot and splat chains will appear here as they are created.";
}
