/**
 * Authoritative conversation and message statistics contracts.
 * Mirrors backend/app/schemas/conversation_stats.py — do not change one side without the other.
 */

import type { MessageRole, MessageStatus } from "./conversation";
import type { Timestamp } from "./common";

/** Number of messages written in one role. */
export interface RoleMessageCount {
  role: MessageRole;
  count: number;
}

/** Number of messages in one delivery status. */
export interface StatusMessageCount {
  status: MessageStatus;
  count: number;
}

/** Metrics derived from the authoritative conversation/message stores. */
export interface ConversationStats {
  total_conversations: number;
  total_messages: number;
  by_role?: RoleMessageCount[];
  by_status?: StatusMessageCount[];
  average_messages_per_conversation?: number;
  last_activity_at?: Timestamp | null;
  generated_at: Timestamp;
}
