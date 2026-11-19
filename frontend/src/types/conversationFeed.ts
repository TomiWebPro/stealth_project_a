/**
 * Authoritative conversation feed contracts.
 * Mirrors backend/app/schemas/conversation_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { MessageRole } from "./conversation";

/** One conversation projected from the authoritative conversation store. */
export interface ConversationFeedItem {
  conversation_id: Uuid;
  project_id: Uuid;
  project_name: string;
  title: string;
  message_count: number;
  last_message_role?: MessageRole | null;
  last_message_excerpt?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** A bounded, newest-first page of conversations with a whole-scope total. */
export interface ConversationFeed {
  items?: ConversationFeedItem[];
  total: number;
  generated_at: Timestamp;
}
