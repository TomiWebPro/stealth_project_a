/**
 * Authoritative provider-feed contracts.
 * Mirrors backend/app/schemas/provider_feed.py — do not change one side without the other.
 */

import type { Timestamp } from "./common";
import type { ProviderLocation, ProviderStatus } from "./provider";

/** One provider projected from the authoritative registry. */
export interface ProviderFeedItem {
  provider_id: string;
  name: string;
  location: ProviderLocation;
  status: ProviderStatus;
  operation_ids?: string[];
  capability_count: number;
}

/** A bounded, deterministic page of providers with a whole-scope total. */
export interface ProviderFeed {
  items?: ProviderFeedItem[];
  total: number;
  generated_at: Timestamp;
}
