/**
 * Authoritative single-operation overview derivation + fetch helper (C230
 * follow-up).
 *
 * The backend (`OperationOverviewRepository`) derives the whole snapshot fresh
 * from the versioned operation catalog and the authoritative provider store on
 * every call — there is no second index. It projects one operation's catalog
 * identity and settings/I/O shape, the sorted/deduplicated set of provider ids
 * declared by the catalog spec and the *actual* providers advertising the
 * operation (with their advertised schema versions and a `schema_match` drift
 * flag), so declared-vs-actual drift is visible to the UI.
 *
 * `lib/operationOverview` reproduces that derivation over the same catalog and
 * provider seeds so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over identical data. An unknown
 * operation is a 404 checked by the fetch layer and normalized to `undefined`
 * by the transports.
 */

import { ApiError } from "../api/client";
import type {
  OperationCatalog,
  OperationOverview,
  OperationProviderBinding,
  Provider,
} from "./types";

/** Python-compatible lexicographic comparison (matches `sorted()` on str). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Derive a single-operation snapshot exactly as the backend repository does.
 * `operationId` is assumed to exist (the fetch layer rejects unknown
 * operations); an unseeded operation throws the shared 404 envelope. Provider
 * bindings and their advertised schema versions are sorted and deduplicated so
 * the wire order is independent of how the registry ordered its capabilities.
 * The counts describe the whole operation and are never bounded down: settings
 * counts every declared setting while `setting_keys` is the deduplicated set.
 */
export function deriveOperationOverview(
  operationId: string,
  providers: readonly Provider[],
  catalog: OperationCatalog,
  now: string,
): OperationOverview {
  const spec = (catalog.operations ?? []).find((candidate) => candidate.id === operationId);
  if (!spec) {
    throw new ApiError({
      status: 404,
      code: "operation_not_found",
      message: `Operation '${operationId}' was not found.`,
    });
  }

  const bindings: OperationProviderBinding[] = [];
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
    bindings.push({
      provider_id: provider.id,
      name: provider.name,
      location: provider.location,
      status: provider.status,
      advertised_versions: versions,
      schema_match: versions.includes(spec.schema_version),
    });
  }
  bindings.sort((a, b) => compareStrings(a.provider_id, b.provider_id));

  const providerIds = [...new Set(spec.provider_ids ?? [])].sort(compareStrings);
  const settingKeys = [...new Set((spec.settings ?? []).map((setting) => setting.key))].sort(
    compareStrings,
  );
  const inputTypes = [...(spec.input?.asset_types ?? [])];
  const outputTypes = [...(spec.output?.asset_types ?? [])];

  return {
    operation_id: spec.id,
    title: spec.title,
    description: spec.description ?? null,
    schema_version: spec.schema_version,
    input_types: inputTypes,
    output_types: outputTypes,
    setting_keys: settingKeys,
    streaming: spec.streaming ?? false,
    provider_ids: providerIds,
    provider_bindings: bindings,
    counts: {
      settings: spec.settings?.length ?? 0,
      input_types: inputTypes.length,
      output_types: outputTypes.length,
      provider_bindings: bindings.length,
      matching_providers: bindings.filter((binding) => binding.schema_match).length,
    },
    generated_at: now,
  };
}
