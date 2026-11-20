/**
 * Authoritative single-capability overview derivation + fetch helpers (C298
 * follow-up).
 *
 * The backend (`CapabilityOverviewRepository`) derives the whole snapshot fresh
 * from the authoritative provider store and the versioned operation catalog on
 * every call — there is no second index. A capability is "known" when it is in
 * the catalog OR at least one provider advertises it; anything else is a shared
 * 404 `capability_not_found`. Each advertising provider contributes exactly one
 * row with its advertised schema versions sorted and deduplicated, together
 * with a `schema_match` drift flag against the catalog version.
 *
 * `lib/capabilityOverview` reproduces that derivation over the same provider
 * and catalog seeds so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { CapabilityOverview, OperationCatalog, Provider } from "./types";

/** Python-compatible lexicographic comparison (matches `sorted()` on str). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Whether the backend would consider this operation id a known capability:
 * present in the versioned catalog or advertised by at least one provider.
 * Used by the fetch layer to normalize the router's 404 to `undefined`.
 */
export function isKnownCapability(
  operationId: string,
  providers: readonly Provider[],
  catalog: OperationCatalog,
): boolean {
  return (
    (catalog.operations ?? []).some((operation) => operation.id === operationId) ||
    providers.some((provider) =>
      (provider.capabilities ?? []).some((capability) => capability.operation_id === operationId),
    )
  );
}

/**
 * Derive a single-capability snapshot exactly as the backend repository does.
 * Unknown capabilities throw the shared 404 envelope; callers that need the
 * detail-lookup semantics should guard with {@link isKnownCapability} first.
 * Advertised versions are deduplicated and re-sorted so the wire order does not
 * depend on how the provider store ordered capabilities. Counts are derived
 * from the whole provider set and are never bounded.
 */
export function deriveCapabilityOverview(
  operationId: string,
  providers: readonly Provider[],
  catalog: OperationCatalog,
  now: string,
): CapabilityOverview {
  const spec = (catalog.operations ?? []).find((operation) => operation.id === operationId);

  const capabilityProviders: NonNullable<CapabilityOverview["providers"]> = [];
  for (const provider of providers) {
    const versions: string[] = [];
    let advertises = false;
    for (const capability of provider.capabilities ?? []) {
      if (capability.operation_id !== operationId) continue;
      advertises = true;
      for (const version of capability.schema_versions ?? []) {
        if (!versions.includes(version)) versions.push(version);
      }
    }
    if (!advertises) continue;
    versions.sort(compareStrings);
    capabilityProviders.push({
      provider_id: provider.id,
      name: provider.name,
      location: provider.location,
      status: provider.status,
      schema_versions: versions,
      schema_match: Boolean(spec && versions.includes(spec.schema_version)),
    });
  }
  capabilityProviders.sort((a, b) => compareStrings(a.provider_id, b.provider_id));

  if (!spec && capabilityProviders.length === 0) {
    throw new ApiError({
      status: 404,
      code: "capability_not_found",
      message: `Capability '${operationId}' was not found.`,
    });
  }

  const statuses = { available: 0, degraded: 0, unavailable: 0 };
  for (const item of capabilityProviders) {
    if (item.status === "available") statuses.available += 1;
    else if (item.status === "degraded") statuses.degraded += 1;
    else if (item.status === "unavailable") statuses.unavailable += 1;
  }
  const locations = new Set(capabilityProviders.map((item) => item.location));
  const allVersions = new Set(capabilityProviders.flatMap((item) => item.schema_versions ?? []));

  return {
    operation_id: operationId,
    in_catalog: Boolean(spec),
    catalog_title: spec?.title ?? null,
    catalog_version: spec?.schema_version ?? null,
    providers: capabilityProviders,
    counts: {
      total_providers: capabilityProviders.length,
      available: statuses.available,
      degraded: statuses.degraded,
      unavailable: statuses.unavailable,
      locations: locations.size,
      schema_versions: allVersions.size,
    },
    generated_at: now,
  };
}
