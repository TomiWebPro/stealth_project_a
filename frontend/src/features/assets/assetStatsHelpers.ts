/**
 * Display models for the authoritative asset inventory statistics (C49/C51/C52
 * follow-up). Every value rendered by `AssetStatsPanel` is derived here from the
 * raw `AssetStats` payload so empty, partial and populated states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Type/status orders mirror the canonical
 * `ASSET_TYPES`/`ASSET_STATUSES` in `lib/assetStats` so the UI always shows a
 * complete zero-filled breakdown.
 */

import type { AssetStats, AssetStatus, AssetType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone } from "./helpers";

export interface AssetStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface AssetTypeRow {
  readonly type: AssetType;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all live assets, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface AssetStatusRow {
  readonly status: AssetStatus;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all live assets, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

const TYPE_ORDER: readonly AssetType[] = [
  "image",
  "video",
  "audio",
  "model3d",
  "splat",
  "texture",
  "dataset",
  "lora",
  "scene",
  "resource",
];

const STATUS_ORDER: readonly AssetStatus[] = [
  "pending",
  "processing",
  "ready",
  "failed",
  "deleted",
];

const TYPE_LABEL: Readonly<Record<AssetType, string>> = {
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

const STATUS_LABEL: Readonly<Record<AssetStatus, string>> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  deleted: "Deleted",
};

const STATUS_TONE: Readonly<Record<AssetStatus, BadgeTone>> = {
  pending: "warning",
  processing: "info",
  ready: "success",
  failed: "danger",
  deleted: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact badge label for an asset type token. */
export function assetTypeLabel(type: AssetType): string {
  return TYPE_LABEL[type] ?? type;
}

/** Compact badge label + tone for an asset lifecycle status. */
export function assetStatusLabel(status: AssetStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function assetStatusTone(status: AssetStatus): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

/** Human-readable byte count with binary units, or an em dash when absent. */
export function formatBytes(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let scaled = value / 1024;
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }
  return `${scaled.toFixed(1)} ${units[unitIndex]}`;
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function assetStatsRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The four authoritative inventory counters, in a stable display order. */
export function assetStatsCards(
  stats?: AssetStats,
  now: number = Date.now(),
): AssetStatsStat[] {
  return [
    {
      key: "total",
      label: "Total assets",
      value: String(stats?.total ?? 0),
      hint: "Live, non-deleted",
    },
    {
      key: "bytes",
      label: "Stored bytes",
      value: formatBytes(stats?.total_size_bytes),
      hint: "Across live assets",
    },
    {
      key: "versions",
      label: "Versions",
      value: String(stats?.total_versions ?? 0),
      hint: "Sum of revisions",
    },
    {
      key: "newest",
      label: "Newest asset",
      value: assetStatsRelativeLabel(stats?.newest_asset_at, now) || "—",
      hint: "Last added",
    },
  ];
}

/** Zero-filled asset-type distribution with a share per type. */
export function assetTypeRows(stats?: AssetStats): AssetTypeRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_type ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.type, entry.count);
  }
  const total = TYPE_ORDER.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0);
  return TYPE_ORDER.map((type) => {
    const count = counts.get(type) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      type,
      label: assetTypeLabel(type),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: assetTypeTone(type) ?? "neutral",
    };
  });
}

/** Zero-filled lifecycle-status distribution with a share per status. */
export function assetStatusRows(stats?: AssetStats): AssetStatusRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_status ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.status, entry.count);
  }
  const total = STATUS_ORDER.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      status,
      label: assetStatusLabel(status),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: assetStatusTone(status),
    };
  });
}

/** True when the snapshot carries at least one live asset or any stored bytes. */
export function hasAssetStatsData(stats?: AssetStats): boolean {
  if (!stats) return false;
  return (
    stats.total > 0 ||
    stats.total_size_bytes > 0 ||
    stats.total_versions > 0 ||
    (stats.by_type?.some((row) => row && row.count > 0) ?? false)
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function assetStatsGeneratedAtLabel(
  stats?: AssetStats,
  now: number = Date.now(),
): string {
  return assetStatsRelativeLabel(stats?.generated_at, now);
}
