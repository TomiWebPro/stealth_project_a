/**
 * Authoritative single-operation overview contracts.
 * Mirrors backend/app/schemas/operation_overview.py — do not change one side without the other.
 */

import type { Timestamp } from "./common";
import type { ProviderLocation, ProviderStatus } from "./provider";

/** A provider advertising this operation, with schema-drift information. */
export interface OperationProviderBinding {
  provider_id: string;
  name: string;
  location: ProviderLocation;
  status: ProviderStatus;
  advertised_versions?: string[];
  schema_match: boolean;
}

/** Shape/coverage totals for one operation, derived authoritatively. */
export interface OperationOverviewCounts {
  settings: number;
  input_types: number;
  output_types: number;
  provider_bindings: number;
  matching_providers: number;
}

/** A single-operation snapshot: catalog identity, shape and provider bindings. */
export interface OperationOverview {
  operation_id: string;
  title: string;
  description?: string | null;
  schema_version: string;
  input_types?: string[];
  output_types?: string[];
  setting_keys?: string[];
  streaming: boolean;
  provider_ids?: string[];
  provider_bindings?: OperationProviderBinding[];
  counts: OperationOverviewCounts;
  generated_at: Timestamp;
}
