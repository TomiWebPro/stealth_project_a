/**
 * Display models for the authoritative operation catalog feed (C189/C191/C192
 * follow-up). The backend derives a bounded, deterministic feed fresh from the
 * authoritative, versioned `OPERATION_CATALOG` — the same registry `/jobs`
 * validates against and `/operations/stats` aggregates — ordered ascending by
 * `(title, operation_id)`. The mocks transport mirrors that derivation so both
 * modes render identically. This module only turns the canonical `OperationFeed`
 * payload into render-ready rows; every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values so JSX stays free of inline
 * derivation.
 */

import type { OperationFeedOptions } from "../../lib/operationFeed";
import type { OperationFeed, OperationFeedItem } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { assetTypeLabel } from "./operationStatsHelpers";

/** Render-ready row for one operation projected from the authoritative catalog. */
export interface OperationFeedRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly versionLabel: string;
  readonly inputTypes: readonly string[];
  readonly outputTypes: readonly string[];
  readonly inputLabel: string;
  readonly outputLabel: string;
  readonly settingsCount: number;
  readonly settingsLabel: string;
  readonly streaming: boolean;
  readonly streamingLabel: string;
  readonly streamingTone: BadgeTone;
  readonly providerIds: readonly string[];
  readonly providerCount: number;
  readonly providerLabel: string;
  readonly providerPreview: string;
}

/** Page-size chips offered above the feed. */
export const OPERATION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/**
 * Streaming-mode chips; `undefined` is the unfiltered "All" chip, `true` the
 * streaming operations and `false` the batch (non-streaming) ones.
 */
export const OPERATION_FEED_STREAMING_FILTERS: readonly (boolean | undefined)[] = [
  undefined,
  true,
  false,
];

/** Query options from the active streaming/provider scope and page size. */
export function buildOperationFeedOptions(
  streaming: boolean | undefined,
  providerId: string | undefined,
  limit: number,
): OperationFeedOptions {
  const trimmed = providerId?.trim();
  return {
    ...(streaming !== undefined ? { streaming } : {}),
    ...(trimmed ? { provider_id: trimmed } : {}),
    limit,
  };
}

/** Human label for a streaming chip (`undefined` is the unfiltered "All" chip). */
export function operationFeedStreamingChipLabel(value: boolean | undefined): string {
  if (value === undefined) return "All";
  return value ? "Streaming" : "Batch";
}

/** Badge label for an operation's streaming capability. */
export function operationFeedStreamingLabel(value: boolean | undefined): string {
  return value ? "Streaming" : "Batch";
}

/** Badge tone for an operation's streaming capability. */
export function operationFeedStreamingTone(value: boolean | undefined): BadgeTone {
  return value ? "accent" : "neutral";
}

/** Stable display title with an operation-id fallback for malformed items. */
export function operationFeedDisplayName(item: OperationFeedItem): string {
  if (typeof item.title === "string" && item.title.trim() !== "") return item.title;
  return item.operation_id;
}

/** Description with a stable fallback for missing/blank copy. */
export function operationFeedDescription(item: OperationFeedItem): string {
  if (typeof item.description === "string" && item.description.trim() !== "") {
    return item.description;
  }
  return "No description provided.";
}

/** Compact settings-count label. */
export function operationFeedSettingsLabel(count: number | undefined): string {
  if (!Number.isFinite(count) || (count ?? 0) < 1) return "No settings";
  const value = count as number;
  return `${value} setting${value === 1 ? "" : "s"}`;
}

/** Compact provider-binding count label. */
export function operationFeedProviderLabel(count: number | undefined): string {
  if (!Number.isFinite(count) || (count ?? 0) < 1) return "No provider";
  const value = count as number;
  return `${value} provider${value === 1 ? "" : "s"}`;
}

/** Human-readable, comma-separated asset types for an input/output side. */
export function operationFeedTypeLabel(types: readonly string[] | undefined): string {
  const clean = (types ?? []).filter((type) => typeof type === "string" && type !== "");
  if (clean.length === 0) return "None";
  return clean.map(assetTypeLabel).join(", ");
}

/** Short preview of the sorted, deduplicated provider bindings. */
export function operationFeedProviderPreview(
  providerIds: readonly string[] | undefined,
  max = 3,
): string {
  const ids = (providerIds ?? []).filter((id) => typeof id === "string" && id !== "");
  if (ids.length === 0) return "Unbound";
  const shown = ids.slice(0, Math.max(1, max)).join(", ");
  return ids.length > max ? `${shown} +${ids.length - max} more` : shown;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the backend's
 * ascending `(title, operation_id)` order (the feed carries no per-item
 * timestamp).
 */
export function operationFeedRows(
  feed: OperationFeed | undefined,
): readonly OperationFeedRow[] {
  const items: readonly OperationFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const providerIds = item.provider_ids ?? [];
    return {
      id: item.operation_id,
      title: operationFeedDisplayName(item),
      description: operationFeedDescription(item),
      versionLabel: `v${item.schema_version}`,
      inputTypes: item.input_types ?? [],
      outputTypes: item.output_types ?? [],
      inputLabel: `In: ${operationFeedTypeLabel(item.input_types)}`,
      outputLabel: `Out: ${operationFeedTypeLabel(item.output_types)}`,
      settingsCount: item.settings_count,
      settingsLabel: operationFeedSettingsLabel(item.settings_count),
      streaming: item.streaming ?? false,
      streamingLabel: operationFeedStreamingLabel(item.streaming ?? false),
      streamingTone: operationFeedStreamingTone(item.streaming ?? false),
      providerIds,
      providerCount: item.provider_count,
      providerLabel: operationFeedProviderLabel(item.provider_count),
      providerPreview: operationFeedProviderPreview(providerIds),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total;
 * `total` counts the whole filtered feed before the `limit` page.
 */
export function operationFeedSummary(rows: readonly OperationFeedRow[], total?: number): string {
  if (rows.length === 0) return "No operations in this feed";
  const count = total ?? rows.length;
  const streaming = rows.filter((row) => row.streaming).length;
  return `${count} operation${count === 1 ? "" : "s"} · ${streaming} streaming`;
}

/** Compact "generated at" label for the feed footer. */
export function operationFeedGeneratedAtLabel(
  feed: OperationFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function operationFeedEmptyDescription(filtered: boolean): string {
  return filtered
    ? "No operations match these filters. Try a different streaming mode or provider, or clear them."
    : "Operations from the authoritative catalog will appear here.";
}
