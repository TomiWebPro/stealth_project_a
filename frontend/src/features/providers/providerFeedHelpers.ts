/**
 * Display models for the authoritative provider feed (C185/C187/C188 follow-up).
 * The backend derives a bounded, deterministic feed fresh from the authoritative
 * `PROVIDERS` registry — the same collection `/providers` lists and
 * `/providers/stats` aggregates — ordered ascending by `(name, provider_id)`.
 * The mocks transport mirrors that derivation so both modes render identically.
 * This module only turns the canonical `ProviderFeed` payload into render-ready
 * rows; every helper tolerates `undefined` (query not settled or failed) and
 * returns render-safe values so JSX stays free of inline derivation.
 */

import type { ProviderFeedOptions } from "../../lib/providerFeed";
import { PROVIDER_LOCATIONS, PROVIDER_STATUSES } from "../../lib/providerStats";
import type {
  ProviderFeed,
  ProviderFeedItem,
  ProviderLocation,
  ProviderStatus,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { providerLocationLabel, providerStatusTone } from "./helpers";
import { humanizeOperationId } from "./providerStatsHelpers";

/** Render-ready row for one provider projected from the authoritative registry. */
export interface ProviderFeedRow {
  readonly id: string;
  readonly name: string;
  readonly location: ProviderLocation;
  readonly locationLabel: string;
  readonly locationTone: BadgeTone;
  readonly status: ProviderStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly capabilityCount: number;
  readonly capabilityLabel: string;
  readonly operationIds: readonly string[];
  readonly operationCount: number;
  readonly operationPreview: string;
}

/** Page-size chips offered above the feed. */
export const PROVIDER_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Runtime-location chips; `undefined` is the unfiltered "All" chip. */
export const PROVIDER_FEED_LOCATION_FILTERS: readonly (ProviderLocation | undefined)[] = [
  undefined,
  ...PROVIDER_LOCATIONS,
];

/** Health-status chips; `undefined` is the unfiltered "All" chip. */
export const PROVIDER_FEED_STATUS_FILTERS: readonly (ProviderStatus | undefined)[] = [
  undefined,
  ...PROVIDER_STATUSES,
];

const LOCATION_TONE: Readonly<Record<ProviderLocation, BadgeTone>> = {
  local: "accent",
  studio: "info",
  cloud: "neutral",
};

/** Query options from the active location/status scope and page size. */
export function buildProviderFeedOptions(
  location: ProviderLocation | undefined,
  status: ProviderStatus | undefined,
  limit: number,
): ProviderFeedOptions {
  return {
    ...(location ? { location } : {}),
    ...(status ? { status } : {}),
    limit,
  };
}

/** Human label for a location chip (`undefined` is the unfiltered "All" chip). */
export function providerFeedLocationChipLabel(location: ProviderLocation | undefined): string {
  return location ? providerLocationLabel(location) : "All";
}

/** Human label for a status chip (`undefined` is the unfiltered "All" chip). */
export function providerFeedStatusChipLabel(status: ProviderStatus | undefined): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "All";
}

/** Badge tone for a canonical runtime location. */
export function providerFeedLocationTone(location: ProviderLocation): BadgeTone {
  return LOCATION_TONE[location] ?? "neutral";
}

/** Badge tone for a canonical health status (shared with the registry view). */
export function providerFeedStatusTone(status: ProviderStatus): BadgeTone {
  return providerStatusTone(status);
}

/** Stable display name with a provider-id fallback for malformed items. */
export function providerFeedDisplayName(item: ProviderFeedItem): string {
  if (typeof item.name === "string" && item.name.trim() !== "") return item.name;
  return item.provider_id;
}

/** Compact advertised-capability label derived from the raw capability count. */
export function providerFeedCapabilityLabel(count: number | undefined): string {
  if (!Number.isFinite(count) || (count ?? 0) < 1) return "No capabilities";
  const value = count as number;
  return `${value} capabilit${value === 1 ? "y" : "ies"}`;
}

/** Short, humanized preview of the sorted advertised operation ids. */
export function providerFeedOperationPreview(
  operationIds: readonly string[] | undefined,
  max = 3,
): string {
  const ops = (operationIds ?? []).filter((id) => typeof id === "string" && id !== "");
  if (ops.length === 0) return "No advertised operations";
  const shown = ops.slice(0, Math.max(1, max)).map(humanizeOperationId).join(", ");
  return ops.length > max ? `${shown} +${ops.length - max} more` : shown;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the backend's
 * ascending `(name, provider_id)` order (the feed carries no per-item timestamp).
 */
export function providerFeedRows(
  feed: ProviderFeed | undefined,
): readonly ProviderFeedRow[] {
  const items: readonly ProviderFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const operationIds = item.operation_ids ?? [];
    return {
      id: item.provider_id,
      name: providerFeedDisplayName(item),
      location: item.location,
      locationLabel: providerFeedLocationChipLabel(item.location),
      locationTone: providerFeedLocationTone(item.location),
      status: item.status,
      statusLabel: providerFeedStatusChipLabel(item.status),
      statusTone: providerFeedStatusTone(item.status),
      capabilityCount: item.capability_count,
      capabilityLabel: providerFeedCapabilityLabel(item.capability_count),
      operationIds,
      operationCount: operationIds.length,
      operationPreview: providerFeedOperationPreview(operationIds),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total;
 * `total` counts the whole filtered feed before the `limit` page.
 */
export function providerFeedSummary(rows: readonly ProviderFeedRow[], total?: number): string {
  if (rows.length === 0) return "No providers in this feed";
  const count = total ?? rows.length;
  const capabilities = rows.reduce((sum, row) => sum + row.capabilityCount, 0);
  return `${count} provider${count === 1 ? "" : "s"} · ${providerFeedCapabilityLabel(capabilities)} advertised`;
}

/** Compact "generated at" label for the feed footer. */
export function providerFeedGeneratedAtLabel(
  feed: ProviderFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function providerFeedEmptyDescription(filtered: boolean): string {
  return filtered
    ? "No providers match these filters. Try a different location or status, or clear them."
    : "Providers from the authoritative registry will appear here.";
}
