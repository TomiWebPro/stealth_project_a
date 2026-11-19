/**
 * Authoritative project feed contracts.
 * Mirrors backend/app/schemas/project_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { ProjectLifecycle } from "./projectStats";

/** One project projected from the authoritative project store. */
export interface ProjectFeedItem {
  project_id: Uuid;
  org_id: Uuid;
  org_name: string;
  name: string;
  description?: string | null;
  lifecycle: ProjectLifecycle;
  created_by: Uuid;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** A bounded, newest-first page of projects with a whole-scope total. */
export interface ProjectFeed {
  items?: ProjectFeedItem[];
  total: number;
  generated_at: Timestamp;
}
