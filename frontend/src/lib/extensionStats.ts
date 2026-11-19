/**
 * Authoritative extension registry/installation statistics derivation + query
 * helpers (C61 follow-up).
 *
 * The backend (`ExtensionStatsRepository`) derives the whole snapshot from the
 * authoritative registry/installation stores on every call — there is no second
 * index. `lib/extensionStats` reproduces that derivation exactly so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over the same seeds.
 *
 * In mock mode a single `EXTENSIONS` seed carries both halves of the data: each
 * installed extension embeds its registry `manifest`. We therefore derive the
 * registry slice (type mix, permission/capability coverage) and the installation
 * slice (status mix, trust flags) from that one seed — the same information the
 * backend reads from its two collections. `type` narrows only the registry slice
 * and `status` only the installation slice, mirroring the router's independent
 * filters.
 */

import { ApiError } from "../api/client";
import type {
  Extension,
  ExtensionPermissionStat,
  ExtensionStats,
  ExtensionStatus,
  ExtensionStatusCount,
  ExtensionType,
  ExtensionTypeCount,
} from "./types";

/** Optional filters mirrored from the authoritative `/extensions/stats` endpoint. */
export interface ExtensionStatsOptions {
  readonly type?: ExtensionType;
  readonly status?: ExtensionStatus;
}

/** Canonical type order, matching `get_args(ExtensionType)` on the backend. */
export const EXTENSION_TYPES: readonly ExtensionType[] = [
  "capability",
  "ui",
  "provider",
  "runtime",
  "bundle",
];

/** Canonical status order, matching `get_args(ExtensionStatus)` on the backend. */
export const EXTENSION_STATUSES: readonly ExtensionStatus[] = [
  "installed",
  "enabled",
  "disabled",
  "update_available",
];

/**
 * Mirror the router's optional enum `type`/`status` validation so mock and live
 * fail identically with the shared normalized error envelope.
 */
export function validateExtensionStatsArgs(options: ExtensionStatsOptions = {}): void {
  if (options.type !== undefined && !EXTENSION_TYPES.includes(options.type)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid extension type.",
      details: [
        { field: "type", message: "type must be one of capability, ui, provider, runtime, bundle" },
      ],
    });
  }
  if (options.status !== undefined && !EXTENSION_STATUSES.includes(options.status)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid extension status.",
      details: [
        {
          field: "status",
          message: "status must be one of installed, enabled, disabled, update_available",
        },
      ],
    });
  }
}

/** Python-compatible lexicographic ordering for the deterministic permission sort. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Derive extension registry/installation metrics exactly as the backend
 * repository does: zero-filled type/status breakdowns, trust flags and
 * permission/capability coverage with a deterministic `(-extensions, name)`
 * permission order. The `type` filter narrows only the registry slice and
 * `status` only the installation slice, so each metric always agrees with its
 * filtered slice. An empty slice yields zero counts and zero-filled arrays.
 */
export function deriveExtensionStats(
  extensions: readonly Extension[],
  now: string,
  options: ExtensionStatsOptions = {},
): ExtensionStats {
  const registry = extensions.filter(
    (extension) => options.type === undefined || extension.manifest.type === options.type,
  );
  const installed = extensions.filter(
    (extension) => options.status === undefined || extension.status === options.status,
  );

  const typeCounts = new Map<ExtensionType, number>();
  const permissionCounts = new Map<string, number>();
  let totalPermissions = 0;
  let totalCapabilities = 0;
  for (const extension of registry) {
    const manifest = extension.manifest;
    typeCounts.set(manifest.type, (typeCounts.get(manifest.type) ?? 0) + 1);
    for (const permission of manifest.requirements.permissions ?? []) {
      totalPermissions += 1;
      permissionCounts.set(permission.name, (permissionCounts.get(permission.name) ?? 0) + 1);
    }
    totalCapabilities += (manifest.requirements.capabilities ?? []).length;
  }

  const statusCounts = new Map<ExtensionStatus, number>();
  let signed = 0;
  let verified = 0;
  for (const extension of installed) {
    statusCounts.set(extension.status, (statusCounts.get(extension.status) ?? 0) + 1);
    if (extension.signed) signed += 1;
    if (extension.verified) verified += 1;
  }

  const byType: ExtensionTypeCount[] = EXTENSION_TYPES.map((type) => ({
    type,
    count: typeCounts.get(type) ?? 0,
  }));
  const byStatus: ExtensionStatusCount[] = EXTENSION_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));
  const byPermission: ExtensionPermissionStat[] = [...permissionCounts.entries()]
    .sort((a, b) => b[1] - a[1] || compareNames(a[0], b[0]))
    .map(([permission, count]) => ({ permission, extensions: count }));

  return {
    total_registered: registry.length,
    total_installed: installed.length,
    by_type: byType,
    by_status: byStatus,
    enabled: statusCounts.get("enabled") ?? 0,
    signed,
    verified,
    total_permissions: totalPermissions,
    unique_permissions: permissionCounts.size,
    by_permission: byPermission,
    total_capabilities: totalCapabilities,
    generated_at: now,
  };
}

/** Query-string values for the live `/extensions/stats` request. */
export function extensionStatsQueryParams(
  options: ExtensionStatsOptions = {},
): Record<string, string | undefined> {
  return { type: options.type, status: options.status };
}
