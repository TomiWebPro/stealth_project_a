/**
 * Authoritative upload statistics contracts.
 * Mirrors backend/app/schemas/upload_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** The two canonical upload-ticket lifecycle states. */
export type UploadStatus = "pending" | "complete";

/** Number of upload tickets in one canonical lifecycle state. */
export interface UploadStatusCount {
  status: UploadStatus;
  count: number;
}

/** Upload activity for one project. */
export interface UploadProjectCount {
  project_id: Uuid;
  total: number;
  completed: number;
  bytes_uploaded: number;
}

/** Upload-ticket metrics derived from the authoritative upload store. */
export interface UploadStats {
  total_tickets: number;
  pending: number;
  completed: number;
  bytes_uploaded: number;
  by_status?: UploadStatusCount[];
  by_project?: UploadProjectCount[];
  newest_upload_at?: Timestamp | null;
  generated_at: Timestamp;
}
