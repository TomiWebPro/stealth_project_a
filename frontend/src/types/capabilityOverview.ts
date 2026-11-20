/**
 * Authoritative single-capability overview contracts.
 * Mirrors backend/app/schemas/capability_overview.ts — do not change one side without the other.
 */

import type { Timestamp } from "./common";
import type { ProviderLocation, ProviderStatus } from "./provider";

/** One provider advertising the capability, with schema coverage. */
export interface CapabilityProvider {
  provider_id: string;
  name: string;
  location: ProviderLocation;
  status: ProviderStatus;
  schema_versions?: string[];
  schema_match: boolean;
}

/** Provider/health/location totals for one capability, derived authoritatively. */
export interface CapabilityOverviewCounts {
  total_providers: number;
  available: number;
  degraded: number;
  unavailable: number;
  locations: number;
  schema_versions: number;
}

/** A single-capability snapshot: catalog binding, providers and counts. */
export interface CapabilityOverview {
  operation_id: string;
  in_catalog: boolean;
  catalog_title?: string | null;
  catalog_version?: string | null;
  providers?: CapabilityProvider[];
  counts: CapabilityOverviewCounts;
  generated_at: Timestamp;
}
