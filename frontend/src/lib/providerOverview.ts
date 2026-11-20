/**
 * Authoritative single-provider overview derivation + fetch helpers (C217
 * follow-up).
 *
 * The backend (`ProviderOverviewRepository`) derives the whole snapshot fresh
 * from the authoritative provider store and the static versioned operation
 * catalog on every call — there is no second index. It projects one provider's
 * identity/health, the sorted/deduplicated set of operations it advertises and
 * the subset of those that bind to the catalog (with the provider's advertised
 * schema versions next to the catalog version and a `schema_match` drift flag).
 *
 * `lib/providerOverview` reproduces that derivation over the same provider and
 * catalog seeds so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over identical data. An unknown
 * provider is a 404 checked by the fetch layer and normalized to `undefined`
 * by the transports; the route has no query params, so there is no page bound
 * to validate.
 */

import { ApiError } from "../api/client";
import type { OperationCatalog, Provider, ProviderOverview } from "./types";

/** Python-compatible lexicographic comparison (matches `sorted()` on str). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Derive a single-provider snapshot exactly as the backend repository does.
 * `providerId` is assumed to exist (the fetch layer rejects unknown providers);
 * an unseeded provider throws the shared 404 envelope. Advertised versions are
 * deduplicated per operation and re-sorted after merging capabilities so the
 * wire order is independent of how the registry ordered them. Operations absent
 * from the catalog are omitted from `catalog_operations` but still counted in
 * `advertised_operations`; counts are never bounded by that projection.
 */
export function deriveProviderOverview(
  providerId: string,
  providers: readonly Provider[],
  catalog: OperationCatalog,
  now: string,
): ProviderOverview {
  const provider = providers.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw new ApiError({
      status: 404,
      code: "provider_not_found",
      message: `Provider '${providerId}' was not found.`,
    });
  }

  const versionsByOperation = new Map<string, string[]>();
  const allVersions = new Set<string>();
  for (const capability of provider.capabilities ?? []) {
    const versions = versionsByOperation.get(capability.operation_id) ?? [];
    for (const version of capability.schema_versions ?? []) {
      if (!versions.includes(version)) versions.push(version);
      allVersions.add(version);
    }
    versionsByOperation.set(capability.operation_id, versions);
  }
  for (const versions of versionsByOperation.values()) versions.sort(compareStrings);
  const operationIds = [...versionsByOperation.keys()].sort(compareStrings);

  const catalogById = new Map((catalog.operations ?? []).map((spec) => [spec.id, spec]));
  const catalogOperations: ProviderOverview["catalog_operations"] = [];
  for (const operationId of operationIds) {
    const spec = catalogById.get(operationId);
    if (!spec) continue;
    const advertised = versionsByOperation.get(operationId) ?? [];
    catalogOperations.push({
      operation_id: operationId,
      title: spec.title,
      catalog_version: spec.schema_version,
      advertised_versions: advertised,
      schema_match: advertised.includes(spec.schema_version),
    });
  }

  return {
    provider_id: provider.id,
    name: provider.name,
    location: provider.location,
    status: provider.status,
    metadata: provider.metadata ?? {},
    operation_ids: operationIds,
    catalog_operations: catalogOperations,
    counts: {
      capabilities: provider.capabilities?.length ?? 0,
      advertised_operations: operationIds.length,
      catalog_operations: catalogOperations.length,
      schema_versions: allVersions.size,
    },
    generated_at: now,
  };
}
