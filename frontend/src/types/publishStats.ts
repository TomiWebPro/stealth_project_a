/**
 * Authoritative publish statistics contracts.
 * Mirrors backend/app/schemas/publish_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** Number of published assets at a given version number. */
export interface PublishVersionCount {
  version: number;
  count: number;
}

/** Publish activity recorded for one project. */
export interface PublishProjectCount {
  project_id: Uuid;
  published: number;
  bytes: number;
}

/** Publish metrics derived from authoritative asset publish receipts. */
export interface PublishStats {
  total_published: number;
  total_bytes: number;
  by_version?: PublishVersionCount[];
  by_project?: PublishProjectCount[];
  newest_published_at?: Timestamp | null;
  generated_at: Timestamp;
}
