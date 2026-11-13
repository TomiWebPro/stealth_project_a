/**
 * Conversation contracts (messages, streaming deltas).
 * Mirrors backend/app/schemas/conversation.py.
 */

import type { Metadata, Timestamp, Uuid } from "./common";

export type MessageRole = "system" | "user" | "assistant" | "tool";
export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface AttachmentRef {
  asset_id: Uuid;
  role?: "input" | "reference";
}

export interface Message {
  id: Uuid;
  conversation_id: Uuid;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  attachments?: AttachmentRef[];
  operation_id?: string | null;
  metadata?: Metadata;
  created_at: Timestamp;
}

export interface Conversation {
  id: Uuid;
  project_id: Uuid;
  title: string;
  created_by: Uuid;
  created_at: Timestamp;
  updated_at: Timestamp;
  message_count?: number;
}

export interface ConversationCreate {
  title: string;
  initial_message?: string | null;
}

export interface MessageCreate {
  role?: MessageRole;
  content: string;
  attachments?: AttachmentRef[];
  operation_id?: string | null;
}

// --- Streaming events (WebSocket frames) ------------------------------------

export type StreamEventType =
  | "message_start"
  | "delta"
  | "message_complete"
  | "error";

/**
 * A single frame on the conversation event stream.
 * `seq` is monotonically increasing per stream so clients can recover after a
 * dropped connection by resuming from the last seen sequence number.
 */
export interface StreamEvent {
  type: StreamEventType;
  message_id: Uuid;
  seq: number;
  delta?: string | null;
  error?: string | null;
}
