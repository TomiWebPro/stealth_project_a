import { describe, expect, it } from "vitest";

import type { Provider, ProviderLocation, ProviderStatus } from "./types";
import {
  PROVIDER_LOCATIONS,
  PROVIDER_STATUSES,
  deriveProviderStats,
  providerStatsQueryParams,
  validateProviderStatsArgs,
} from "./providerStats";
import { REFERENCE_NOW } from "./mock/data";

function provider(
  id: string,
  location: ProviderLocation,
  status: ProviderStatus,
  operationIds: readonly string[],
): Provider {
  return {
    id,
    name: `provider-${id}`,
    location,
    status,
    capabilities: operationIds.map((operation_id) => ({ operation_id })),
  };
}

const PROVIDERS: readonly Provider[] = [
  provider("p1", "local", "available", ["op-b", "op-a", "op-c"]),
  provider("p2", "cloud", "available", ["op-b", "op-d"]),
  provider("p3", "cloud", "degraded", ["op-b"]),
];

describe("deriveProviderStats", () => {
  it("zero-fills every breakdown for an empty store", () => {
    expect(deriveProviderStats([], REFERENCE_NOW)).toEqual({
      total: 0,
      by_status: PROVIDER_STATUSES.map((status) => ({ status, count: 0 })),
      by_location: PROVIDER_LOCATIONS.map((location) => ({ location, count: 0 })),
      available: 0,
      degraded: 0,
      unavailable: 0,
      total_capabilities: 0,
      unique_operations: 0,
      by_operation: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives status/location breakdowns and deterministic operation coverage", () => {
    const stats = deriveProviderStats(PROVIDERS, REFERENCE_NOW);

    expect(stats.total).toBe(3);
    expect(stats.available).toBe(2);
    expect(stats.degraded).toBe(1);
    expect(stats.unavailable).toBe(0);
    expect(stats.by_status).toEqual([
      { status: "available", count: 2 },
      { status: "unavailable", count: 0 },
      { status: "degraded", count: 1 },
    ]);
    expect(stats.by_location).toEqual([
      { location: "local", count: 1 },
      { location: "studio", count: 0 },
      { location: "cloud", count: 2 },
    ]);
    expect(stats.total_capabilities).toBe(6);
    expect(stats.unique_operations).toBe(4);
    // Sorted by -providers then operation_id, with only available providers counted
    // in each operation's `available` bucket.
    expect(stats.by_operation).toEqual([
      { operation_id: "op-b", providers: 3, available: 2 },
      { operation_id: "op-a", providers: 1, available: 1 },
      { operation_id: "op-c", providers: 1, available: 1 },
      { operation_id: "op-d", providers: 1, available: 1 },
    ]);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("treats a provider with no capabilities as coverage-free", () => {
    const stats = deriveProviderStats([provider("p4", "studio", "unavailable", [])], REFERENCE_NOW);
    expect(stats.total).toBe(1);
    expect(stats.unavailable).toBe(1);
    expect(stats.total_capabilities).toBe(0);
    expect(stats.unique_operations).toBe(0);
    expect(stats.by_operation).toEqual([]);
  });

  it("narrows every metric to one location before deriving", () => {
    const stats = deriveProviderStats(PROVIDERS, REFERENCE_NOW, { location: "cloud" });
    expect(stats.total).toBe(2);
    expect(stats.available).toBe(1);
    expect(stats.degraded).toBe(1);
    expect(stats.by_location).toEqual([
      { location: "local", count: 0 },
      { location: "studio", count: 0 },
      { location: "cloud", count: 2 },
    ]);
    expect(stats.total_capabilities).toBe(3);
    expect(stats.unique_operations).toBe(2);
    expect(stats.by_operation).toEqual([
      { operation_id: "op-b", providers: 2, available: 1 },
      { operation_id: "op-d", providers: 1, available: 1 },
    ]);
  });

  it("narrows every metric to one status before deriving", () => {
    const stats = deriveProviderStats(PROVIDERS, REFERENCE_NOW, { status: "available" });
    expect(stats.total).toBe(2);
    expect(stats.available).toBe(2);
    expect(stats.degraded).toBe(0);
    expect(stats.total_capabilities).toBe(5);
    expect(stats.by_operation).toEqual([
      { operation_id: "op-b", providers: 2, available: 2 },
      { operation_id: "op-a", providers: 1, available: 1 },
      { operation_id: "op-c", providers: 1, available: 1 },
      { operation_id: "op-d", providers: 1, available: 1 },
    ]);
  });

  it("applies location and status filters together and zero-fills an empty slice", () => {
    const both = deriveProviderStats(PROVIDERS, REFERENCE_NOW, {
      location: "cloud",
      status: "degraded",
    });
    expect(both.total).toBe(1);
    expect(both.degraded).toBe(1);
    expect(both.total_capabilities).toBe(1);

    const empty = deriveProviderStats(PROVIDERS, REFERENCE_NOW, { location: "studio" });
    expect(empty.total).toBe(0);
    expect(empty.by_operation).toEqual([]);
    expect(empty.by_status).toEqual(PROVIDER_STATUSES.map((status) => ({ status, count: 0 })));
  });
});

describe("validateProviderStatsArgs", () => {
  it("rejects an invalid location with a 422 envelope", () => {
    expect(() => validateProviderStatsArgs({ location: "moon" as never })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "location" })],
      }),
    );
  });

  it("rejects an invalid status with a 422 envelope", () => {
    expect(() => validateProviderStatsArgs({ status: "busy" as never })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "status" })],
      }),
    );
  });

  it("accepts canonical values or an omitted filter", () => {
    expect(() => validateProviderStatsArgs()).not.toThrow();
    expect(() => validateProviderStatsArgs({ location: "cloud", status: "degraded" })).not.toThrow();
  });
});

describe("providerStatsQueryParams", () => {
  it("maps the filters to the authoritative query string", () => {
    expect(providerStatsQueryParams()).toEqual({ location: undefined, status: undefined });
    expect(providerStatsQueryParams({ location: "local", status: "available" })).toEqual({
      location: "local",
      status: "available",
    });
  });
});
