/**
 * Authoritative provider-feed derivation + query helpers (C185 follow-up).
 *
 * The backend (`ProviderFeedRepository`) keeps no second index: it derives a
 * bounded, deterministic feed fresh from the authoritative `PROVIDERS` collection
 * — the same static registry `/providers` lists and `/providers/stats` aggregates
 * — so the three views can never drift. The registry carries no registration
 * timestamp, so items are ordered by ascending `(name, provider_id)` for a stable
 * cross-backend sequence. Each item projects provider identity/health plus a
 * sorted, deduplicated list of advertised `operation_id`s and the raw capability
 * count (so duplicate advertising is still visible). Optional `location`/`status`
 * filters narrow the derivation before `total` is counted.
 *
 * `lib/providerFeed` reproduces that derivation over the same provider seeds so
 * mock mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data. Invalid filter values and page bounds use
 * the shared 422 envelope, matching the router's query validation.
 */

import { ApiError } from "../api/client";
import { PROVIDER_LOCATIONS, PROVIDER_STATUSES } from "./providerStats";
import type {
  Provider,
  ProviderFeed,
  ProviderFeedItem,
  ProviderLocation,
  ProviderStatus,
} from "./types";

/** Optional filters/page bound mirrored from the authoritative `/providers/feed` endpoint. */
export interface ProviderFeedOptions {
  readonly location?: ProviderLocation;
  readonly status?: ProviderStatus;
  readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's optional enum `location`/`status` and bounded `limit`
 * validation so mock and live fail identically with the shared error envelope.
 */
export function validateProviderFeedArgs(options: ProviderFeedOptions = {}): void {
  if (options.location !== undefined && !PROVIDER_LOCATIONS.includes(options.location)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid provider location.",
      details: [
        { field: "location", message: "location must be one of local, studio, cloud" },
      ],
    });
  }
  if (options.status !== undefined && !PROVIDER_STATUSES.includes(options.status)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid provider status.",
      details: [
        { field: "status", message: "status must be one of available, unavailable, degraded" },
      ],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/** Python-compatible ascending `(name, provider_id)` comparison. */
function compareByName(a: ProviderFeedItem, b: ProviderFeedItem): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  if (a.provider_id !== b.provider_id) return a.provider_id < b.provider_id ? -1 : 1;
  return 0;
}

/**
 * Derive the feed exactly as the backend repository does: project each provider
 * with sorted/deduplicated advertised operation ids and the raw capability count,
 * filter by location/status, sort by ascending `(name, provider_id)` and apply the
 * `limit` page. `total` counts the whole filtered feed before paging; an empty
 * scope yields an empty feed (never an error).
 */
export function deriveProviderFeed(
  providers: readonly Provider[],
  now: string,
  options: ProviderFeedOptions = {},
): ProviderFeed {
  const { limit = DEFAULT_LIMIT } = options;
  const items: ProviderFeedItem[] = providers
    .filter(
      (provider) =>
        (options.location === undefined || provider.location === options.location) &&
        (options.status === undefined || provider.status === options.status),
    )
    .map((provider) => {
      const capabilities = provider.capabilities ?? [];
      return {
        provider_id: provider.id,
        name: provider.name,
        location: provider.location,
        status: provider.status,
        operation_ids: [...new Set(capabilities.map((capability) => capability.operation_id))].sort(),
        capability_count: capabilities.length,
      };
    });
  items.sort(compareByName);
  return { items: items.slice(0, limit), total: items.length, generated_at: now };
}

/** Query-string values for the live `/providers/feed` request. */
export function providerFeedQueryParams(
  options: ProviderFeedOptions = {},
): Record<string, string | number | undefined> {
  return { location: options.location, status: options.status, limit: options.limit };
}
