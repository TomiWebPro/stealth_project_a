/**
 * Authoritative provider fleet statistics contracts.
 * Mirrors backend/app/schemas/provider_stats.py — do not change one side without the other.
 */

import type { ProviderLocation, ProviderStatus } from "./provider";
import type { Timestamp } from "./common";

/** Number of providers in one health status. */
export interface ProviderStatusCount {
  status: ProviderStatus;
  count: number;
}

/** Number of providers at one runtime location. */
export interface ProviderLocationCount {
  location: ProviderLocation;
  count: number;
}

/** How many providers advertise an operation, and how many are available. */
export interface ProviderOperationStat {
  operation_id: string;
  providers: number;
  available: number;
}

/** Fleet metrics derived from the authoritative provider store. */
export interface ProviderStats {
  total: number;
  by_status?: ProviderStatusCount[];
  by_location?: ProviderLocationCount[];
  available: number;
  degraded: number;
  unavailable: number;
  total_capabilities: number;
  unique_operations: number;
  by_operation?: ProviderOperationStat[];
  generated_at: Timestamp;
}
