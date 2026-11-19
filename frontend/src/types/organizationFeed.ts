/**
 * Authoritative organization-feed contracts.
 * Mirrors backend/app/schemas/organization_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** One organization projected from the authoritative store with activity counts. */
export interface OrganizationFeedItem {
  org_id: Uuid;
  name: string;
  slug: string;
  member_count: number;
  project_count: number;
  created_at: Timestamp;
}

/** A bounded, newest-first page of organizations with a whole-scope total. */
export interface OrganizationFeed {
  items?: OrganizationFeedItem[];
  total: number;
  generated_at: Timestamp;
}
