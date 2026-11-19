/**
 * Display models for the authoritative production-pipeline statistics (C73/C75/
 * C76 follow-up). Every value rendered by `PipelineStatsPanel` is derived here
 * from the raw `PipelineStats` payload so empty, partial and populated states
 * stay consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The three pipeline kinds are always present
 * in a fixed training/shot/splat order, matching `lib/pipelineStats` and the
 * backend's zero-filled breakdown.
 */

import type { PipelineKind, PipelineStats } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface PipelineStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface PipelineKindRow {
  readonly kind: PipelineKind;
  readonly label: string;
  readonly chains: number;
  readonly jobs: number;
  readonly assets: number;
  /** Rounded share of all chains produced by this kind, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface PipelineProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly chains: number;
  /** Rounded share of all chains produced for this project, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

const KIND_LABELS: Readonly<Record<PipelineKind, string>> = {
  training: "Training",
  shot: "Shot",
  splat: "Splat",
};

const KIND_TONES: Readonly<Record<PipelineKind, BadgeTone>> = {
  training: "warning",
  shot: "info",
  splat: "success",
};

const CANONICAL_KINDS: readonly PipelineKind[] = ["training", "shot", "splat"];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Python-compatible lexicographic ordering for deterministic id tie-breaks. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Friendly label for a canonical pipeline kind, or a humanized fallback. */
export function pipelineKindLabel(kind: PipelineKind | string): string {
  if (kind === "training" || kind === "shot" || kind === "splat") {
    return KIND_LABELS[kind];
  }
  return String(kind)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Stable badge tone for a pipeline kind. */
export function pipelineKindTone(kind: PipelineKind | string): BadgeTone {
  if (kind === "training" || kind === "shot" || kind === "splat") {
    return KIND_TONES[kind];
  }
  return "neutral";
}

/** Short, readable id for a project row. */
export function shortProjectLabel(projectId: string): string {
  if (!projectId) return "";
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function pipelineStatsRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** The three authoritative counters, in a stable display order. */
export function pipelineStatsCards(stats?: PipelineStats): PipelineStat[] {
  return [
    {
      key: "chains",
      label: "Chains",
      value: String(stats?.total_chains ?? 0),
      hint: "Pipeline runs",
    },
    {
      key: "jobs",
      label: "Jobs",
      value: String(stats?.total_jobs ?? 0),
      hint: "Chain-spawned jobs",
    },
    {
      key: "assets",
      label: "Assets",
      value: String(stats?.total_assets ?? 0),
      hint: "Chain-produced assets",
    },
  ];
}

/**
 * Zero-filled per-kind breakdown in canonical training/shot/splat order. Any
 * additional (non-canonical) kinds from a payload are appended after them so
 * the UI never drops data while keeping a deterministic order.
 */
export function pipelineKindRows(stats?: PipelineStats): PipelineKindRow[] {
  const entries = stats?.by_kind ?? [];
  const totalChains = stats?.total_chains ?? 0;
  const byKind = new Map<string, (typeof entries)[number]>(
    entries.map((row) => [String(row.kind), row]),
  );
  const order: string[] = [...CANONICAL_KINDS];
  for (const key of byKind.keys()) {
    if (!order.includes(key)) order.push(key);
  }

  return order.map((kind) => {
    const row = byKind.get(kind);
    const chains = Number.isFinite(row?.chains) ? (row?.chains ?? 0) : 0;
    const jobs = Number.isFinite(row?.jobs) ? (row?.jobs ?? 0) : 0;
    const assets = Number.isFinite(row?.assets) ? (row?.assets ?? 0) : 0;
    const fraction = clamp01(totalChains > 0 ? chains / totalChains : 0);
    return {
      kind: kind as PipelineKind,
      label: pipelineKindLabel(kind),
      chains,
      jobs,
      assets,
      percent: Math.round(fraction * 100),
      fraction,
      tone: pipelineKindTone(kind),
    };
  });
}

/**
 * Per-project chain counts, sorted count-descending then by project id for
 * deterministic cross-backend order. `limit` caps the number of rows shown.
 */
export function pipelineProjectRows(
  stats?: PipelineStats,
  limit: number = 5,
): PipelineProjectRow[] {
  const totalChains = stats?.total_chains ?? 0;
  const entries = (stats?.by_project ?? [])
    .filter((row) => row && Number.isFinite(row.chains))
    .sort((a, b) => b.chains - a.chains || compareNames(a.project_id, b.project_id));
  const capped = Number.isFinite(limit) && limit > 0 ? entries.slice(0, limit) : entries;

  return capped.map((row) => {
    const fraction = clamp01(totalChains > 0 ? row.chains / totalChains : 0);
    return {
      projectId: row.project_id,
      label: shortProjectLabel(row.project_id),
      chains: row.chains,
      percent: Math.round(fraction * 100),
      fraction,
    };
  });
}

/**
 * True when the snapshot carries any non-zero chain/job/asset metrics. The
 * backend always zero-fills the three kind buckets, so their presence alone is
 * not evidence of data — only positive counts are.
 */
export function hasPipelineStatsData(stats?: PipelineStats): boolean {
  if (!stats) return false;
  if (stats.total_chains > 0 || stats.total_jobs > 0 || stats.total_assets > 0) {
    return true;
  }
  if (
    (stats.by_kind ?? []).some(
      (row) => row.chains > 0 || row.jobs > 0 || row.assets > 0,
    )
  ) {
    return true;
  }
  return (stats.by_project ?? []).some((row) => row.chains > 0);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function pipelineStatsGeneratedAtLabel(
  stats?: PipelineStats,
  now: number = Date.now(),
): string {
  return pipelineStatsRelativeLabel(stats?.generated_at, now);
}

/** Compact relative recency label for the newest chain, or an empty label. */
export function newestChainLabel(stats?: PipelineStats, now: number = Date.now()): string {
  return pipelineStatsRelativeLabel(stats?.newest_chain_at, now);
}
