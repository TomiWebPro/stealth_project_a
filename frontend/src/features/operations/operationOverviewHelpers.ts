/**
 * Display models for the authoritative single-operation overview (C230/C232/C233
 * follow-up). Every value rendered by `OperationOverviewPanel` is derived here
 * from the raw `OperationOverview` snapshot so loading/error/missing/empty/
 * populated states stay consistent across mock and live transports and the JSX
 * stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown
 * operation) and return zero-filled, render-safe values. Location/health labels
 * and asset-type names reuse the existing provider/operation helpers so the
 * overview can never drift from the workspace-wide provider and catalog views.
 */

import type {
  OperationOverview,
  OperationOverviewCounts,
  OperationProviderBinding,
  OperationSpec,
  ProviderLocation,
  ProviderStatus,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { providerLocationLabel, providerStatusTone } from "../providers/helpers";
import { operationFeedTypeLabel } from "./operationFeedHelpers";

export interface OperationOverviewIdentity {
  readonly titleLabel: string;
  readonly operationIdLabel: string;
  readonly description: string;
  readonly schemaLabel: string;
  readonly streamingLabel: string;
  readonly streamingTone: BadgeTone;
}

export interface OperationOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface OperationOverviewBindingRow {
  readonly key: string;
  readonly providerId: string;
  readonly nameLabel: string;
  readonly locationLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly advertisedLabel: string;
  readonly schemaLabel: string;
  readonly schemaTone: BadgeTone;
  readonly drift: boolean;
}

export interface OperationOverviewCoverage {
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
export function operationOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function operationOverviewGeneratedAtLabel(
  overview?: OperationOverview | null,
  now: number = Date.now(),
): string {
  return operationOverviewRelativeLabel(overview?.generated_at, now);
}

/** Short, human-friendly label for a catalog operation id in a compact header. */
export function operationOverviewShortId(operationId?: string | null): string {
  if (!operationId) return "—";
  return operationId.length > 24 ? `${operationId.slice(0, 24)}…` : operationId;
}

/** Picker label for one catalog operation in the panel's operation selector. */
export function operationOptionLabel(spec: OperationSpec): string {
  const title = spec.title?.trim() || "Untitled operation";
  return spec.id ? `${title} · ${spec.id}` : title;
}

/** Authoritative shape/coverage counts, zero-filled for missing snapshots. */
export function operationOverviewCounts(
  overview?: OperationOverview | null,
): OperationOverviewCounts {
  const counts = overview?.counts;
  return {
    settings: nonNegativeCount(counts?.settings),
    input_types: nonNegativeCount(counts?.input_types),
    output_types: nonNegativeCount(counts?.output_types),
    provider_bindings: nonNegativeCount(counts?.provider_bindings),
    matching_providers: nonNegativeCount(counts?.matching_providers),
  };
}

/** Identity, shape and streaming badges for the snapshot header. */
export function operationOverviewIdentity(
  overview?: OperationOverview | null,
): OperationOverviewIdentity {
  const operationId = overview?.operation_id?.trim() || "";
  return {
    titleLabel: overview?.title?.trim() || operationId || "Unknown operation",
    operationIdLabel: operationOverviewShortId(operationId),
    description: overview?.description?.trim() || "No description provided.",
    schemaLabel: overview?.schema_version?.trim() || "—",
    streamingLabel: overview?.streaming ? "Streaming" : "Batch",
    streamingTone: overview?.streaming ? "info" : "neutral",
  };
}

/** The four headline shape counters, in a stable display order. */
export function operationOverviewStatRows(
  overview?: OperationOverview | null,
): OperationOverviewStat[] {
  const counts = operationOverviewCounts(overview);
  return [
    {
      key: "settings",
      label: "Settings",
      value: String(counts.settings),
      hint: "User-facing settings",
    },
    {
      key: "input",
      label: "Input types",
      value: String(counts.input_types),
      hint: "Accepted asset types",
    },
    {
      key: "output",
      label: "Output types",
      value: String(counts.output_types),
      hint: "Produced asset types",
    },
    {
      key: "providers",
      label: "Providers",
      value: String(counts.provider_bindings),
      hint: "Advertising this operation",
    },
  ];
}

/** Human-readable, comma-separated asset types for the catalog input/output side. */
export function operationOverviewTypesLabel(types: readonly string[] | undefined): string {
  return operationFeedTypeLabel(types);
}

/** Comma-separated setting keys, or "—" when the operation exposes none. */
export function operationOverviewSettingKeysLabel(keys: readonly string[] | undefined): string {
  const clean = (keys ?? []).filter((key) => typeof key === "string" && key !== "");
  return clean.length > 0 ? clean.join(", ") : "—";
}

/** Provider bindings projected into deterministic, render-safe rows. */
export function operationOverviewBindingRows(
  overview?: OperationOverview | null,
): OperationOverviewBindingRow[] {
  return [...(overview?.provider_bindings ?? [])]
    .sort((a, b) => (a.provider_id || "").localeCompare(b.provider_id || ""))
    .map((binding: OperationProviderBinding, index: number) => {
      const providerId = binding.provider_id || "";
      const location: ProviderLocation | undefined = binding.location;
      const status: ProviderStatus | undefined = binding.status;
      const advertised = (binding.advertised_versions ?? []).filter(
        (version) => typeof version === "string" && version !== "",
      );
      const drift = !binding.schema_match;
      return {
        key: providerId || `binding-${index}`,
        providerId,
        nameLabel: binding.name?.trim() || providerId || "Unknown provider",
        locationLabel: location ? providerLocationLabel(location) : "Unknown",
        statusLabel: status ? capitalize(status) : "Unknown",
        statusTone: status ? providerStatusTone(status) : "neutral",
        advertisedLabel: advertised.length > 0 ? advertised.join(", ") : "—",
        schemaLabel: drift ? "Drift" : "Match",
        schemaTone: drift ? "warning" : "success",
        drift,
      };
    });
}

/** Sorted, deduplicated declared provider ids (non-empty only). */
export function operationOverviewDeclaredProviderIds(
  overview?: OperationOverview | null,
): string[] {
  return [...new Set((overview?.provider_ids ?? []).filter((id) => typeof id === "string" && id !== ""))].sort();
}

/** Declared provider ids with no binding advertising this operation. */
export function operationOverviewUnboundProviderIds(
  overview?: OperationOverview | null,
): string[] {
  const bound = new Set(
    (overview?.provider_bindings ?? [])
      .map((binding) => binding.provider_id)
      .filter((id) => typeof id === "string" && id !== ""),
  );
  return operationOverviewDeclaredProviderIds(overview).filter((id) => !bound.has(id));
}

/** Number of bindings whose advertised versions include the catalog version. */
export function operationOverviewSchemaMatchCount(
  overview?: OperationOverview | null,
): number {
  return (overview?.provider_bindings ?? []).filter((binding) => binding.schema_match).length;
}

/** Schema-match coverage as a clamped 0..1 fraction and a rounded percent. */
export function operationOverviewCoverage(
  overview?: OperationOverview | null,
): OperationOverviewCoverage {
  const total = (overview?.provider_bindings ?? []).length;
  const matched = operationOverviewSchemaMatchCount(overview);
  const fraction = total > 0 ? Math.min(1, Math.max(0, matched / total)) : 0;
  return {
    matched,
    total,
    fraction,
    percent: Math.round(fraction * 100),
  };
}

/** False only when the snapshot is missing or has no shape/binding activity. */
export function hasOperationOverviewData(overview?: OperationOverview | null): boolean {
  if (!overview) return false;
  const counts = operationOverviewCounts(overview);
  return (
    counts.settings > 0 ||
    counts.input_types > 0 ||
    counts.output_types > 0 ||
    (overview.setting_keys?.length ?? 0) > 0 ||
    operationOverviewDeclaredProviderIds(overview).length > 0 ||
    (overview.provider_bindings?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function operationOverviewSummaryLabel(
  overview?: OperationOverview | null,
): string {
  if (!overview) return "";
  const counts = operationOverviewCounts(overview);
  const coverage = operationOverviewCoverage(overview);
  return `${counts.settings} setting${counts.settings === 1 ? "" : "s"} · ${coverage.matched}/${coverage.total} schema match${coverage.total === 1 ? "" : "es"}`;
}
