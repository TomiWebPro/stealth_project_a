/**
 * Display models for the authoritative extension registry/installation
 * statistics (C61/C63/C64 follow-up). Every value rendered by
 * `ExtensionStatsPanel` is derived here from the raw `ExtensionStats` payload
 * so empty, partial and populated states stay consistent across mock and live
 * transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Breakdown orders mirror the canonical
 * `EXTENSION_TYPES` / `EXTENSION_STATUSES` in `lib/extensionStats` so the UI
 * always shows a complete zero-filled breakdown.
 */

import type { ExtensionStats, ExtensionStatus, ExtensionType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { extensionStatusTone } from "./helpers";

export interface ExtensionStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ExtensionTypeStatRow {
  readonly type: ExtensionType;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all registry manifests in scope, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ExtensionStatusStatRow {
  readonly status: ExtensionStatus;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ExtensionPermissionStatRow {
  readonly permission: string;
  readonly extensions: number;
  /** Rounded share of registry manifests declaring this permission, 0..100. */
  readonly percent: number;
  readonly fraction: number;
}

export interface ExtensionTrustStatRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Share of installed extensions carrying the trust flag, 0..1. */
  readonly fraction: number;
  readonly percent: number;
  readonly tone: BadgeTone;
}

const TYPE_ORDER: readonly ExtensionType[] = [
  "capability",
  "ui",
  "provider",
  "runtime",
  "bundle",
];

const STATUS_ORDER: readonly ExtensionStatus[] = [
  "installed",
  "enabled",
  "disabled",
  "update_available",
];

const TYPE_LABEL: Readonly<Record<ExtensionType, string>> = {
  capability: "Capability",
  ui: "UI",
  provider: "Provider",
  runtime: "Runtime",
  bundle: "Bundle",
};

const TYPE_TONE: Readonly<Record<ExtensionType, BadgeTone>> = {
  capability: "accent",
  ui: "info",
  provider: "accent",
  runtime: "info",
  bundle: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Human-readable label for a hyphen/underscore identifier. */
export function humanizeExtensionId(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Python-compatible lexicographic ordering for deterministic permission ties. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The four authoritative headline counters, in a stable display order. */
export function extensionStatsCards(stats?: ExtensionStats): ExtensionStatsStat[] {
  return [
    {
      key: "registered",
      label: "Registered",
      value: String(stats?.total_registered ?? 0),
      hint: "Manifests in the registry",
    },
    {
      key: "installed",
      label: "Installed",
      value: String(stats?.total_installed ?? 0),
      hint: "Installed in this scope",
    },
    {
      key: "enabled",
      label: "Enabled",
      value: String(stats?.enabled ?? 0),
      hint: "Actively running",
    },
    {
      key: "permissions",
      label: "Permissions",
      value: String(stats?.unique_permissions ?? 0),
      hint: "Unique declared scopes",
    },
  ];
}

/** Zero-filled registry type distribution with a share per type. */
export function extensionTypeRows(stats?: ExtensionStats): ExtensionTypeStatRow[] {
  const counts = new Map<string, number>();
  for (const row of stats?.by_type ?? []) {
    if (row && Number.isFinite(row.count)) counts.set(row.type, row.count);
  }
  const total = TYPE_ORDER.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0);
  return TYPE_ORDER.map((type) => {
    const count = counts.get(type) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      type,
      label: TYPE_LABEL[type] ?? humanizeExtensionId(type),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: TYPE_TONE[type] ?? "neutral",
    };
  });
}

/** Zero-filled installation status distribution with a share per status. */
export function extensionStatusRows(stats?: ExtensionStats): ExtensionStatusStatRow[] {
  const counts = new Map<string, number>();
  for (const row of stats?.by_status ?? []) {
    if (row && Number.isFinite(row.count)) counts.set(row.status, row.count);
  }
  const total = STATUS_ORDER.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      status,
      label: humanizeExtensionId(status),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: extensionStatusTone(status),
    };
  });
}

/** Permission coverage, busiest first, as a share of registered manifests. */
export function extensionPermissionRows(stats?: ExtensionStats): ExtensionPermissionStatRow[] {
  const registered = stats?.total_registered ?? 0;
  return (stats?.by_permission ?? [])
    .filter((row) => row && Number.isFinite(row.extensions))
    .map((row) => {
      const fraction = clamp01(registered > 0 ? row.extensions / registered : 0);
      return {
        permission: row.permission,
        extensions: row.extensions,
        fraction,
        percent: Math.round(fraction * 100),
      };
    })
    .sort(
      (a, b) =>
        b.extensions - a.extensions || compareNames(a.permission, b.permission),
    );
}

/** Signed / verified trust flags as a share of installed extensions. */
export function extensionTrustRows(stats?: ExtensionStats): ExtensionTrustStatRow[] {
  const installed = stats?.total_installed ?? 0;
  const flags: readonly { readonly key: string; readonly label: string; readonly count: number }[] = [
    { key: "signed", label: "Signed", count: stats?.signed ?? 0 },
    { key: "verified", label: "Verified", count: stats?.verified ?? 0 },
  ];
  return flags.map((flag) => {
    const fraction = clamp01(installed > 0 ? flag.count / installed : 0);
    let tone: BadgeTone = "neutral";
    if (installed > 0 && flag.count === installed) tone = "success";
    else if (flag.count > 0) tone = "warning";
    return {
      ...flag,
      fraction,
      percent: Math.round(fraction * 100),
      tone,
    };
  });
}

/** True when the snapshot carries at least one registry/installation fact. */
export function hasExtensionStatsData(stats?: ExtensionStats): boolean {
  if (!stats) return false;
  return (
    stats.total_registered > 0 ||
    stats.total_installed > 0 ||
    stats.total_permissions > 0 ||
    stats.total_capabilities > 0 ||
    (stats.by_permission?.length ?? 0) > 0
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function extensionStatsGeneratedAtLabel(
  stats?: ExtensionStats,
  now: number = Date.now(),
): string {
  if (!stats?.generated_at) return "";
  return formatRelative(stats.generated_at, now);
}
