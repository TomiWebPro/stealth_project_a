/**
 * Authoritative single-provider overview contracts.
 * Mirrors backend/app/schemas/provider_overview.ts — do not change one side without the other.
 */

import type { Metadata, Timestamp } from "./common";
import type { ProviderLocation, ProviderStatus } from "./provider";

/** A catalog-backed operation advertised by this provider. */
export interface ProviderOverviewOperation {
  operation_id: string;
  title: string;
  catalog_version: string;
  advertised_versions?: string[];
  schema_match: boolean;
}

/** Capability/coverage totals for one provider, derived authoritatively. */
export interface ProviderOverviewCounts {
  capabilities: number;
  advertised_operations: number;
  catalog_operations: number;
  schema_versions: number;
}

/** A single-provider snapshot: identity, coverage and catalog bindings. */
export interface ProviderOverview {
  provider_id: string;
  name: string;
  location: ProviderLocation;
  status: ProviderStatus;
  metadata?: Metadata;
  operation_ids?: string[];
  catalog_operations?: ProviderOverviewOperation[];
  counts: ProviderOverviewCounts;
  generated_at: Timestamp;
}
