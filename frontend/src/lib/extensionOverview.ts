/**
 * Authoritative single-extension overview derivation + fetch helper (C222
 * follow-up).
 *
 * The backend (`ExtensionOverviewRepository`) derives the whole snapshot fresh
 * from the authoritative installed-extension store on every call — there is no
 * second index. It projects one extension's manifest identity, lifecycle/trust
 * flags and declared scope (permission names, capabilities, provider ids, UI
 * contributions and dependency ids), each sorted and deduplicated so the wire
 * shape is byte-for-byte identical regardless of declaration order; every
 * `counts` total equals the emitted list length.
 *
 * `lib/extensionOverview` reproduces that derivation over the same `EXTENSIONS`
 * seed so mock mode stays at feature parity with live mode and the parity guard
 * can drive both transports over identical data. The extension id is the same
 * deterministic `uuid5(NAMESPACE_URL, "studio-extension:{manifest_id}")`
 * installation uses (see `extensionFeed.extensionId`), so the overview agrees
 * with `/extensions` and `/extensions/feed`. An unknown extension is a 404
 * checked by the fetch layer and normalized to `undefined` by the transports;
 * the route has no query params, so there is no page bound to validate.
 */

import { ApiError } from "../api/client";
import { extensionId } from "./extensionFeed";
import type { Extension, ExtensionOverview } from "./types";

/** Sorted, de-duplicated projection, independent of declaration order. */
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * Derive a single-extension snapshot exactly as the backend repository does.
 * `id` is the deterministic uuid5 of the manifest; an unseeded extension throws
 * the shared 404 envelope. The fetch layer rejects unknown ids before calling
 * this, so here the 404 is a defensive guard for direct callers.
 */
export function deriveExtensionOverview(
  id: string,
  extensions: readonly Extension[],
  now: string,
): ExtensionOverview {
  const extension = extensions.find((candidate) => extensionId(candidate.manifest.id) === id);
  if (!extension) {
    throw new ApiError({
      status: 404,
      code: "extension_not_found",
      message: `Extension '${id}' was not found.`,
    });
  }

  const manifest = extension.manifest;
  const requirements = manifest.requirements;
  const permissions = uniqueSorted(
    (requirements.permissions ?? []).map((permission) => permission.name),
  );
  const capabilities = uniqueSorted(requirements.capabilities ?? []);
  const providerIds = uniqueSorted(requirements.provider_ids ?? []);
  const uiContributions = uniqueSorted(manifest.ui_contributions ?? []);
  const dependencies = uniqueSorted(
    (manifest.dependencies ?? []).map((dependency) => dependency.extension_id),
  );

  return {
    extension_id: id,
    manifest_id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    publisher: manifest.publisher,
    type: manifest.type,
    status: extension.status,
    installed_at: extension.installed_at ?? null,
    runtime: requirements.runtime ?? null,
    app_versions: requirements.app_versions,
    signed: extension.signed ?? false,
    verified: extension.verified ?? false,
    permissions,
    capabilities,
    provider_ids: providerIds,
    ui_contributions: uiContributions,
    dependencies,
    counts: {
      permissions: permissions.length,
      capabilities: capabilities.length,
      provider_ids: providerIds.length,
      ui_contributions: uiContributions.length,
      dependencies: dependencies.length,
    },
    generated_at: now,
  };
}
