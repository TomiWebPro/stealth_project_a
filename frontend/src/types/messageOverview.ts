/**
 * Authoritative single conversation-message overview contracts.
 * Mirrors backend/app/schemas/message_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { AttachmentRef, Message, MessageRole, MessageStatus } from "./conversation";
import type { RoleMessageCount, StatusMessageCount } from "./conversationStats";

/** Whole-conversation message totals, derived from the authoritative store. */
export interface MessageOverviewCounts {
  total: number;
  by_role?: RoleMessageCount[];
  by_status?: StatusMessageCount[];
}

/** A single-message snapshot: identity, context, counts and recent siblings. */
export interface MessageOverview {
  message_id: Uuid;
  conversation_id: Uuid;
  conversation_title: string;
  project_id: Uuid;
  project_name: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  position: number;
  attachments?: AttachmentRef[];
  operation_id?: string | null;
  created_at: Timestamp;
  counts: MessageOverviewCounts;
  recent_siblings?: Message[];
  generated_at: Timestamp;
}
