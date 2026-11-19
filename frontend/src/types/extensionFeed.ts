/**
 * Authoritative extension installation feed contracts.
 * Mirrors backend/app/schemas/extension_feed.py — do not change one side without the other.
 */

import type { ExtensionStatus, ExtensionType } from "./provider";
import type { Timestamp, Uuid } from "./common";

/** One installed extension projected from the authoritative store. */
export interface ExtensionFeedItem {
  extension_id: Uuid;
  manifest_id: string;
  name: string;
  version: string;
  publisher: string;
  type: ExtensionType;
  status: ExtensionStatus;
  signed: boolean;
  verified: boolean;
  installed_at: Timestamp;
}

/** A bounded, newest-first page of installed extensions with a total. */
export interface ExtensionFeed {
  items?: ExtensionFeedItem[];
  total: number;
  generated_at: Timestamp;
}
