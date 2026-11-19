/**
 * Authoritative extension registry/installation statistics contracts.
 * Mirrors backend/app/schemas/extension_stats.ts — do not change one side without the other.
 */

import type { ExtensionStatus, ExtensionType } from "./provider";
import type { Timestamp } from "./common";

/** Number of registry manifests of one extension type. */
export interface ExtensionTypeCount {
  type: ExtensionType;
  count: number;
}

/** Number of installed extensions in one lifecycle status. */
export interface ExtensionStatusCount {
  status: ExtensionStatus;
  count: number;
}

/** How many registry manifests declare a permission. */
export interface ExtensionPermissionStat {
  permission: string;
  extensions: number;
}

/** Registry/installation metrics derived from the authoritative stores. */
export interface ExtensionStats {
  total_registered: number;
  total_installed: number;
  by_type?: ExtensionTypeCount[];
  by_status?: ExtensionStatusCount[];
  enabled: number;
  signed: number;
  verified: number;
  total_permissions: number;
  unique_permissions: number;
  by_permission?: ExtensionPermissionStat[];
  total_capabilities: number;
  generated_at: Timestamp;
}
