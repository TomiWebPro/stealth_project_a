/**
 * Display models for the authoritative provider fleet statistics (C57/C59/C60
 * follow-up). Every value rendered by `ProviderStatsPanel` is derived here from
 * the raw `ProviderStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Breakdown orders mirror the canonical
 * `PROVIDER_STATUSES` / `PROVIDER_LOCATIONS` in `lib/providerStats` so the UI
 * always shows a complete zero-filled breakdown.
 */

import type { ProviderLocation, ProviderStats, ProviderStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { providerLocationLabel, providerStatusTone } from "./helpers";

export interface ProviderStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ProviderStatusStatRow {
  readonly status: ProviderStatus;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all providers in scope, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ProviderLocationStatRow {
  readonly location: ProviderLocation;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ProviderOperationStatRow {
  readonly operationId: string;
  readonly label: string;
  readonly providers: number;
  readonly available: number;
  /** Rounded share of advertising providers that are available, 0..100. */
  readonly availabilityPercent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly availabilityFraction: number;
  readonly tone: BadgeTone;
}

const STATUS_ORDER: readonly ProviderStatus[] = ["available", "degraded", "unavailable"];
const LOCATION_ORDER: readonly ProviderLocation[] = ["local", "studio", "cloud"];

const LOCATION_TONE: Readonly<Record<ProviderLocation, BadgeTone>> = {
  local: "accent",
  studio: "info",
  cloud: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Human-readable label for a hyphen/underscore operation id. */
export function humanizeOperationId(operationId: string): string {
  return operationId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function providerStatsRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** The four authoritative fleet counters, in a stable display order. */
export function providerStatsCards(stats?: ProviderStats): ProviderStatsStat[] {
  return [
    {
      key: "total",
      label: "Total providers",
      value: String(stats?.total ?? 0),
      hint: "In this scope",
    },
    {
      key: "available",
      label: "Available",
      value: String(stats?.available ?? 0),
      hint: "Healthy runtimes",
    },
    {
      key: "capabilities",
      label: "Capabilities",
      value: String(stats?.total_capabilities ?? 0),
      hint: "Advertised operations",
    },
    {
      key: "operations",
      label: "Unique operations",
      value: String(stats?.unique_operations ?? 0),
      hint: "Distinct operation IDs",
    },
  ];
}

/** Zero-filled health-status distribution with a share per status. */
export function providerStatusRows(stats?: ProviderStats): ProviderStatusStatRow[] {
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
      label: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: providerStatusTone(status),
    };
  });
}

/** Zero-filled runtime-location distribution with a share per location. */
export function providerLocationRows(stats?: ProviderStats): ProviderLocationStatRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_location ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.location, entry.count);
  }
  const total = LOCATION_ORDER.reduce((sum, location) => sum + (counts.get(location) ?? 0), 0);
  return LOCATION_ORDER.map((location) => {
    const count = counts.get(location) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      location,
      label: providerLocationLabel(location),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: LOCATION_TONE[location] ?? "neutral",
    };
  });
}

/** Per-operation coverage, busiest first, with an availability share. */
export function providerOperationRows(stats?: ProviderStats): ProviderOperationStatRow[] {
  return (stats?.by_operation ?? [])
    .filter((row) => row && Number.isFinite(row.providers))
    .map((row) => {
      const providers = row.providers;
      const available = Number.isFinite(row.available) ? row.available : 0;
      const fraction = clamp01(providers > 0 ? available / providers : 0);
      let tone: BadgeTone = "neutral";
      if (providers > 0 && available === providers) tone = "success";
      else if (available > 0) tone = "warning";
      else if (providers > 0) tone = "danger";
      return {
        operationId: row.operation_id,
        label: humanizeOperationId(row.operation_id),
        providers,
        available,
        availabilityPercent: Math.round(fraction * 100),
        availabilityFraction: fraction,
        tone,
      };
    })
    .sort((a, b) => b.providers - a.providers || a.operationId.localeCompare(b.operationId));
}

/** True when the snapshot carries at least one provider or advertised operation. */
export function hasProviderStatsData(stats?: ProviderStats): boolean {
  if (!stats) return false;
  return (
    stats.total > 0 ||
    stats.total_capabilities > 0 ||
    (stats.by_operation?.length ?? 0) > 0
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function providerStatsGeneratedAtLabel(
  stats?: ProviderStats,
  now: number = Date.now(),
): string {
  return providerStatsRelativeLabel(stats?.generated_at, now);
}
