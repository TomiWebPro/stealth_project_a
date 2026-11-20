/**
 * Authoritative single-extension overview contracts.
 * Mirrors backend/app/schemas/extension_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { ExtensionStatus, ExtensionType } from "./provider";

/** Declaration totals for one extension, derived authoritatively. */
export interface ExtensionOverviewCounts {
  permissions: number;
  capabilities: number;
  provider_ids: number;
  ui_contributions: number;
  dependencies: number;
}

/** A single-extension snapshot: manifest identity, trust and declared scope. */
export interface ExtensionOverview {
  extension_id: Uuid;
  manifest_id: string;
  name: string;
  version: string;
  publisher: string;
  type: ExtensionType;
  status: ExtensionStatus;
  installed_at?: Timestamp | null;
  runtime?: string | null;
  app_versions: string;
  signed: boolean;
  verified: boolean;
  permissions?: string[];
  capabilities?: string[];
  provider_ids?: string[];
  ui_contributions?: string[];
  dependencies?: string[];
  counts: ExtensionOverviewCounts;
  generated_at: Timestamp;
}
