/**
 * Authoritative operation catalog feed contracts.
 * Mirrors backend/app/schemas/operation_feed.py — do not change one side without the other.
 */

import type { Timestamp } from "./common";

/** One operation projected from the authoritative catalog. */
export interface OperationFeedItem {
  operation_id: string;
  title: string;
  description?: string | null;
  schema_version: string;
  input_types?: string[];
  output_types?: string[];
  settings_count: number;
  streaming?: boolean;
  provider_ids?: string[];
  provider_count: number;
}

/** A bounded, deterministic page of operations with a whole-scope total. */
export interface OperationFeed {
  items?: OperationFeedItem[];
  total: number;
  generated_at: Timestamp;
}
