/**
 * Authoritative conversation/message statistics derivation + query helpers (C45 follow-up).
 *
 * The backend (`ConversationStatsRepository`) derives the whole snapshot from
 * the authoritative conversation and message stores on every call — there is no
 * second index. `lib/conversationStats` reproduces that derivation exactly so
 * mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type {
  Conversation,
  ConversationStats,
  Message,
  MessageRole,
  MessageStatus,
  RoleMessageCount,
  StatusMessageCount,
} from "./types";

/** Optional scope mirrored from the authoritative `/conversations/stats` endpoint. */
export interface ConversationStatsOptions {
  readonly projectId?: string;
}

/** Canonical message roles, matching `get_args(MessageRole)` on the backend. */
export const MESSAGE_ROLES: readonly MessageRole[] = ["system", "user", "assistant", "tool"];

/** Canonical delivery statuses, matching `get_args(MessageStatus)` on the backend. */
export const MESSAGE_STATUSES: readonly MessageStatus[] = [
  "pending",
  "streaming",
  "complete",
  "error",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope.
 */
export function validateConversationStatsArgs(options: ConversationStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/** Python-compatible 3-decimal rounding for the derived average. */
function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Derive conversation metrics exactly as the backend repository does: a
 * zero-filled role/status breakdown over canonical message orders, message and
 * conversation totals, a 3-decimal mean over conversations and the newest
 * conversation `updated_at`. Only messages belonging to scoped conversations are
 * counted; an empty scope yields zero counts, empty arrays and a `null` last
 * activity (never an error).
 */
export function deriveConversationStats(
  conversations: readonly Conversation[],
  messages: readonly Message[],
  now: string,
  options: ConversationStatsOptions = {},
): ConversationStats {
  const scoped = options.projectId
    ? conversations.filter((conversation) => conversation.project_id === options.projectId)
    : conversations;
  const conversationIds = new Set(scoped.map((conversation) => conversation.id));
  const scopedMessages = messages.filter((message) =>
    conversationIds.has(message.conversation_id),
  );

  const roleCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const message of scopedMessages) {
    roleCounts.set(message.role, (roleCounts.get(message.role) ?? 0) + 1);
    if (message.status) {
      statusCounts.set(message.status, (statusCounts.get(message.status) ?? 0) + 1);
    }
  }

  const byRole: RoleMessageCount[] = MESSAGE_ROLES.map((role) => ({
    role,
    count: roleCounts.get(role) ?? 0,
  }));
  const byStatus: StatusMessageCount[] = MESSAGE_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  const totalConversations = scoped.length;
  const totalMessages = scopedMessages.length;
  const average = totalConversations ? round3(totalMessages / totalConversations) : 0.0;
  const lastActivity = scoped.reduce<string | null>(
    (latest, conversation) =>
      latest === null || conversation.updated_at.localeCompare(latest) > 0
        ? conversation.updated_at
        : latest,
    null,
  );

  return {
    total_conversations: totalConversations,
    total_messages: totalMessages,
    by_role: byRole,
    by_status: byStatus,
    average_messages_per_conversation: average,
    last_activity_at: lastActivity,
    generated_at: now,
  };
}

/** Query-string values for the live `/conversations/stats` request. */
export function conversationStatsQueryParams(
  options: ConversationStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
