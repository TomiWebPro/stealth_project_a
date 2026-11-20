/**
 * Display models for the authoritative single-provider overview (C217/C220/C221
 * follow-up). Every value rendered by `ProviderOverviewPanel` is derived here
 * from the raw `ProviderOverview` snapshot so loading/error/missing/empty/
 * populated states stay consistent across mock and live transports and the JSX
 * stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown
 * provider) and return zero-filled, render-safe values. Health labels/tones
 * reuse the existing provider helpers so the overview can never drift from the
 * workspace-wide provider list.
 */

import type {
  Provider,
  ProviderOverview,
  ProviderOverviewOperation,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { providerLocationLabel, providerStatusTone } from "./helpers";

export interface ProviderOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ProviderOverviewOperationRow {
  readonly key: string;
  readonly operationId: string;
  readonly title: string;
  readonly catalogVersion: string;
  readonly advertisedVersionsLabel: string;
  readonly schemaLabel: string;
  readonly schemaTone: BadgeTone;
  readonly drift: boolean;
}

export interface ProviderOverviewIdentity {
  readonly nameLabel: string;
  readonly providerIdLabel: string;
  readonly locationLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
}

export interface ProviderOverviewCoverage {
  readonly matched: number;
  readonly total: number;
  readonly fraction: number;
  readonly percent: number;
}

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function providerOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function providerOverviewGeneratedAtLabel(
  overview?: ProviderOverview | null,
  now: number = Date.now(),
): string {
  return providerOverviewRelativeLabel(overview?.generated_at, now);
}

/** Short, human-friendly label for a provider id in a compact header. */
export function providerOverviewShortId(providerId?: string | null): string {
  if (!providerId) return "—";
  return providerId.length > 16 ? `${providerId.slice(0, 16)}…` : providerId;
}

/** Picker label for one provider in the panel's provider selector. */
export function providerOptionLabel(provider: Provider): string {
  const name = provider.name?.trim() || "Unnamed provider";
  return provider.id ? `${name} · ${provider.id}` : name;
}

/** Authoritative coverage counts, zero-filled for missing/malformed snapshots. */
export function providerOverviewCounts(overview?: ProviderOverview | null) {
  const counts = overview?.counts;
  return {
    capabilities: nonNegativeCount(counts?.capabilities),
    advertisedOperations: nonNegativeCount(counts?.advertised_operations),
    catalogOperations: nonNegativeCount(counts?.catalog_operations),
    schemaVersions: nonNegativeCount(counts?.schema_versions),
  };
}

/** Identity/health badges for the snapshot header. */
export function providerOverviewIdentity(
  overview?: ProviderOverview | null,
): ProviderOverviewIdentity {
  const status = overview?.status;
  return {
    nameLabel: overview?.name?.trim() || "Unknown provider",
    providerIdLabel: providerOverviewShortId(overview?.provider_id),
    locationLabel: overview?.location
      ? providerLocationLabel(overview.location)
      : "Unknown",
    statusLabel: status ? capitalize(status) : "Unknown",
    statusTone: status ? providerStatusTone(status) : "neutral",
  };
}

/** The four headline coverage counters, in a stable display order. */
export function providerOverviewStatRows(
  overview?: ProviderOverview | null,
): ProviderOverviewStat[] {
  const counts = providerOverviewCounts(overview);
  return [
    {
      key: "capabilities",
      label: "Capabilities",
      value: String(counts.capabilities),
      hint: "Advertised capability records",
    },
    {
      key: "advertised",
      label: "Advertised ops",
      value: String(counts.advertisedOperations),
      hint: "Distinct operation IDs",
    },
    {
      key: "catalog",
      label: "Catalog ops",
      value: String(counts.catalogOperations),
      hint: "Bound to the operation catalog",
    },
    {
      key: "versions",
      label: "Schema versions",
      value: String(counts.schemaVersions),
      hint: "Distinct advertised versions",
    },
  ];
}

/** Catalog-bound operations projected into render-safe rows. */
export function providerOverviewOperationRows(
  overview?: ProviderOverview | null,
): ProviderOverviewOperationRow[] {
  return (overview?.catalog_operations ?? []).map(
    (operation: ProviderOverviewOperation, index: number) => {
      const operationId = operation.operation_id || `operation-${index}`;
      const advertised = (operation.advertised_versions ?? []).filter(Boolean);
      return {
        key: operation.operation_id || String(index),
        operationId,
        title: operation.title?.trim() || operationId,
        catalogVersion: operation.catalog_version || "—",
        advertisedVersionsLabel: advertised.length > 0 ? advertised.join(", ") : "—",
        schemaLabel: operation.schema_match ? "Match" : "Drift",
        schemaTone: operation.schema_match ? "success" : "warning",
        drift: !operation.schema_match,
      };
    },
  );
}

/** Advertised operation IDs that have no binding in the catalog. */
export function providerOverviewUnboundOperationIds(
  overview?: ProviderOverview | null,
): string[] {
  const bound = new Set(
    (overview?.catalog_operations ?? [])
      .map((operation) => operation.operation_id)
      .filter(Boolean),
  );
  return (overview?.operation_ids ?? []).filter(
    (operationId) => Boolean(operationId) && !bound.has(operationId),
  );
}

/** Number of catalog bindings whose advertised versions include the catalog version. */
export function providerOverviewSchemaMatchCount(
  overview?: ProviderOverview | null,
): number {
  return (overview?.catalog_operations ?? []).filter(
    (operation) => operation.schema_match,
  ).length;
}

/** Schema-match coverage as a clamped 0..1 fraction and a rounded percent. */
export function providerOverviewCoverage(
  overview?: ProviderOverview | null,
): ProviderOverviewCoverage {
  const total = (overview?.catalog_operations ?? []).length;
  const matched = providerOverviewSchemaMatchCount(overview);
  const fraction = total > 0 ? Math.min(1, Math.max(0, matched / total)) : 0;
  return {
    matched,
    total,
    fraction,
    percent: Math.round(fraction * 100),
  };
}

/** False only when the snapshot is missing or has no advertised/catalog activity. */
export function hasProviderOverviewData(overview?: ProviderOverview | null): boolean {
  if (!overview) return false;
  const counts = providerOverviewCounts(overview);
  return (
    counts.capabilities > 0 ||
    counts.advertisedOperations > 0 ||
    counts.catalogOperations > 0 ||
    (overview.operation_ids?.length ?? 0) > 0 ||
    (overview.catalog_operations?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function providerOverviewSummaryLabel(
  overview?: ProviderOverview | null,
): string {
  if (!overview) return "";
  const counts = providerOverviewCounts(overview);
  const coverage = providerOverviewCoverage(overview);
  return `${counts.advertisedOperations} advertised · ${counts.catalogOperations} catalog-bound · ${coverage.matched} schema match${
    coverage.matched === 1 ? "" : "es"
  }`;
}
