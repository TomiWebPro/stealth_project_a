/**
 * Display models for the authoritative operation catalog statistics (C65/C67/
 * C68 follow-up). Every value rendered by `OperationStatsPanel` is derived here
 * from the raw `OperationStats` payload so empty, partial and populated states
 * stay consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Breakdown order mirrors the canonical
 * `lib/operationStats` derivation so the UI always shows a deterministic,
 * count-descending asset-type breakdown.
 */

import type { OperationStats, OperationTypeCount } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface OperationStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface OperationTypeRow {
  readonly assetType: string;
  readonly label: string;
  readonly operations: number;
  /** Rounded share of all catalog operations using this asset type, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

export interface OperationProviderCoverage {
  readonly withProvider: number;
  readonly withoutProvider: number;
  /** Rounded share of catalog operations bound to a provider, 0..100. */
  readonly coveredPercent: number;
  readonly coveredFraction: number;
  readonly tone: BadgeTone;
}

const ASSET_TYPE_LABELS: Readonly<Record<string, string>> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  model3d: "Model 3D",
  splat: "Splat",
  texture: "Texture",
  dataset: "Dataset",
  lora: "LoRA",
  scene: "Scene",
  resource: "Resource",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Python-compatible lexicographic ordering, matching `lib/operationStats`. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Human-readable label for a known asset type, or a humanized fallback. */
export function assetTypeLabel(assetType: string): string {
  const known = ASSET_TYPE_LABELS[assetType];
  if (known) return known;
  return assetType
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function operationStatsRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** The authoritative catalog counters, in a stable display order. */
export function operationStatsCards(stats?: OperationStats): OperationStatsStat[] {
  return [
    { key: "total", label: "Operations", value: String(stats?.total ?? 0), hint: "In the catalog" },
    {
      key: "streaming",
      label: "Streaming",
      value: String(stats?.streaming ?? 0),
      hint: "Live event output",
    },
    {
      key: "with_provider",
      label: "With provider",
      value: String(stats?.with_provider ?? 0),
      hint: "Runtime-bound operations",
    },
    {
      key: "total_settings",
      label: "Settings",
      value: String(stats?.total_settings ?? 0),
      hint: "User-facing controls",
    },
    {
      key: "unique_output_types",
      label: "Output types",
      value: String(stats?.unique_output_types ?? 0),
      hint: "Distinct asset outputs",
    },
  ];
}

/** Provider-bound vs unbound operations, with a coverage share and tone. */
export function operationProviderCoverage(stats?: OperationStats): OperationProviderCoverage {
  const withProvider = stats?.with_provider ?? 0;
  const withoutProvider = stats?.without_provider ?? 0;
  const total = withProvider + withoutProvider;
  const coveredFraction = clamp01(total > 0 ? withProvider / total : 0);
  let tone: BadgeTone = "neutral";
  if (total > 0 && coveredFraction === 1) tone = "success";
  else if (coveredFraction > 0) tone = "warning";
  return {
    withProvider,
    withoutProvider,
    coveredPercent: Math.round(coveredFraction * 100),
    coveredFraction,
    tone,
  };
}

/**
 * Asset-type breakdown for one side of the catalog (output by default),
 * sorted count-descending then by name for deterministic cross-backend order.
 */
export function operationTypeRows(
  stats?: OperationStats,
  kind: "output" | "input" = "output",
): OperationTypeRow[] {
  const entries: readonly OperationTypeCount[] | undefined =
    kind === "input" ? stats?.by_input_type : stats?.by_output_type;
  const total = stats?.total ?? 0;
  return (entries ?? [])
    .filter((row) => row && Number.isFinite(row.operations))
    .map((row) => {
      const fraction = clamp01(total > 0 ? row.operations / total : 0);
      return {
        assetType: row.asset_type,
        label: assetTypeLabel(row.asset_type),
        operations: row.operations,
        percent: Math.round(fraction * 100),
        fraction,
      };
    })
    .sort(
      (a, b) => b.operations - a.operations || compareNames(a.assetType, b.assetType),
    );
}

/** True when the snapshot carries at least one operation or type breakdown. */
export function hasOperationStatsData(stats?: OperationStats): boolean {
  if (!stats) return false;
  return (
    stats.total > 0 ||
    (stats.by_output_type?.length ?? 0) > 0 ||
    (stats.by_input_type?.length ?? 0) > 0
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function operationStatsGeneratedAtLabel(
  stats?: OperationStats,
  now: number = Date.now(),
): string {
  return operationStatsRelativeLabel(stats?.generated_at, now);
}
