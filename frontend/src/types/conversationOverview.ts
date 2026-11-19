/**
 * Authoritative single-conversation overview contracts.
 * Mirrors backend/app/schemas/conversation_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { Message, MessageRole } from "./conversation";
import type { RoleMessageCount, StatusMessageCount } from "./conversationStats";

/** Message totals for one conversation, derived from the authoritative store. */
export interface ConversationOverviewCounts {
  total: number;
  by_role?: RoleMessageCount[];
  by_status?: StatusMessageCount[];
}

/** A single-conversation snapshot: identity, counts and a few recent messages. */
export interface ConversationOverview {
  conversation_id: Uuid;
  project_id: Uuid;
  project_name: string;
  title: string;
  created_by: Uuid;
  created_at: Timestamp;
  updated_at: Timestamp;
  message_count: number;
  last_message_role?: MessageRole | null;
  last_message_excerpt?: string | null;
  counts: ConversationOverviewCounts;
  recent_messages?: Message[];
  generated_at: Timestamp;
}
