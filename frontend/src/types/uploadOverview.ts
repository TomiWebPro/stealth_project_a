/**
 * Authoritative single-upload-ticket overview contracts.
 * Mirrors backend/app/schemas/upload_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { UploadStatus } from "./uploadStats";

/** Whole-project upload activity for the ticket's project, never bounded. */
export interface UploadOverviewCounts {
  project_tickets: number;
  project_completed: number;
  project_bytes_uploaded: number;
}

/** A single-upload snapshot: identity, lifecycle and project activity. */
export interface UploadOverview {
  upload_id: Uuid;
  project_id: Uuid;
  project_name: string;
  filename: string;
  content_type: string;
  status: UploadStatus;
  declared_size: number;
  size_bytes: number;
  bytes_remaining: number;
  progress: number;
  expired: boolean;
  created_at: Timestamp;
  expires_at: Timestamp;
  counts: UploadOverviewCounts;
  generated_at: Timestamp;
}
