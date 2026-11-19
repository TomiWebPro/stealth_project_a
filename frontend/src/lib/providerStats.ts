/**
 * Authoritative provider fleet statistics derivation + query helpers (C57 follow-up).
 *
 * The backend (`ProviderStatsRepository`) derives the whole snapshot from the
 * authoritative provider store on every call — there is no second index.
 * `lib/providerStats` reproduces that derivation exactly so mock mode stays at
 * feature parity with live mode and the parity guard can drive both transports
 * over the same seeds.
 */

import { ApiError } from "../api/client";
import type {
  Provider,
  ProviderLocation,
  ProviderLocationCount,
  ProviderOperationStat,
  ProviderStats,
  ProviderStatus,
  ProviderStatusCount,
} from "./types";

/** Optional filters mirrored from the authoritative `/providers/stats` endpoint. */
export interface ProviderStatsOptions {
  readonly location?: ProviderLocation;
  readonly status?: ProviderStatus;
}

/** Canonical health-status order, matching `get_args(ProviderStatus)` on the backend. */
export const PROVIDER_STATUSES: readonly ProviderStatus[] = [
  "available",
  "unavailable",
  "degraded",
];

/** Canonical runtime-location order, matching `get_args(ProviderLocation)` on the backend. */
export const PROVIDER_LOCATIONS: readonly ProviderLocation[] = ["local", "studio", "cloud"];

/**
 * Mirror the router's optional enum `location`/`status` validation so mock and
 * live fail identically with the shared normalized error envelope.
 */
export function validateProviderStatsArgs(options: ProviderStatsOptions = {}): void {
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
}

/** Python-compatible lexicographic ordering for the deterministic operation sort. */
function compareOperationIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Derive provider fleet metrics exactly as the backend repository does:
 * zero-filled status/location breakdowns, capability coverage with per-operation
 * provider + available counts, and a deterministic `(-providers, operation_id)`
 * operation order. Optional filters narrow the slice before any metric is
 * computed, so the snapshot always agrees with the filtered providers. An empty
 * slice yields zero counts and zero-filled arrays (never an error).
 */
export function deriveProviderStats(
  providers: readonly Provider[],
  now: string,
  options: ProviderStatsOptions = {},
): ProviderStats {
  const scoped = providers.filter(
    (provider) =>
      (options.location === undefined || provider.location === options.location) &&
      (options.status === undefined || provider.status === options.status),
  );

  const statusCounts = new Map<ProviderStatus, number>();
  const locationCounts = new Map<ProviderLocation, number>();
  const operationProviders = new Map<string, number>();
  const operationAvailable = new Map<string, number>();
  let totalCapabilities = 0;

  for (const provider of scoped) {
    statusCounts.set(provider.status, (statusCounts.get(provider.status) ?? 0) + 1);
    locationCounts.set(provider.location, (locationCounts.get(provider.location) ?? 0) + 1);
    for (const capability of provider.capabilities ?? []) {
      totalCapabilities += 1;
      const operation = capability.operation_id;
      operationProviders.set(operation, (operationProviders.get(operation) ?? 0) + 1);
      if (provider.status === "available") {
        operationAvailable.set(operation, (operationAvailable.get(operation) ?? 0) + 1);
      }
    }
  }

  const byStatus: ProviderStatusCount[] = PROVIDER_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));
  const byLocation: ProviderLocationCount[] = PROVIDER_LOCATIONS.map((location) => ({
    location,
    count: locationCounts.get(location) ?? 0,
  }));
  const byOperation: ProviderOperationStat[] = [...operationProviders.entries()]
    .sort((a, b) => b[1] - a[1] || compareOperationIds(a[0], b[0]))
    .map(([operation_id, count]) => ({
      operation_id,
      providers: count,
      available: operationAvailable.get(operation_id) ?? 0,
    }));

  return {
    total: scoped.length,
    by_status: byStatus,
    by_location: byLocation,
    available: statusCounts.get("available") ?? 0,
    degraded: statusCounts.get("degraded") ?? 0,
    unavailable: statusCounts.get("unavailable") ?? 0,
    total_capabilities: totalCapabilities,
    unique_operations: operationProviders.size,
    by_operation: byOperation,
    generated_at: now,
  };
}

/** Query-string values for the live `/providers/stats` request. */
export function providerStatsQueryParams(
  options: ProviderStatsOptions = {},
): Record<string, string | undefined> {
  return { location: options.location, status: options.status };
}
