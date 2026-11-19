/**
 * Authoritative upload-ticket feed contracts.
 * Mirrors backend/app/schemas/upload_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { UploadStatus } from "./uploadStats";

/** One upload ticket projected from the authoritative upload store. */
export interface UploadFeedItem {
  upload_id: Uuid;
  project_id: Uuid;
  project_name: string;
  filename: string;
  content_type: string;
  status: UploadStatus;
  declared_size: number;
  size_bytes: number;
  created_at: Timestamp;
  expires_at: Timestamp;
}

/** A bounded, newest-first page of upload tickets with a whole-scope total. */
export interface UploadFeed {
  items?: UploadFeedItem[];
  total: number;
  generated_at: Timestamp;
}
