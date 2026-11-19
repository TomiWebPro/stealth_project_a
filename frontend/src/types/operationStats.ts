/**
 * Authoritative operation catalog statistics contracts.
 * Mirrors backend/app/schemas/operation_stats.py — do not change one side without the other.
 */

import type { Timestamp } from "./common";

/** Number of catalog operations consuming/producing one asset-type string. */
export interface OperationTypeCount {
  asset_type: string;
  operations: number;
}

/** Catalog metrics derived from the authoritative operation catalog. */
export interface OperationStats {
  total: number;
  streaming: number;
  with_provider: number;
  without_provider: number;
  total_settings: number;
  unique_output_types: number;
  by_output_type?: OperationTypeCount[];
  by_input_type?: OperationTypeCount[];
  generated_at: Timestamp;
}
