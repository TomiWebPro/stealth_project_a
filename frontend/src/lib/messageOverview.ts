/**
 * Authoritative single conversation-message overview derivation + query helpers
 * (C270 follow-up).
 *
 * The backend (`MessageOverviewRepository`) derives the whole snapshot fresh from
 * its authoritative conversation, message and project stores on every call —
 * there is no second index. It projects one message's identity/context, the
 * 1-based chronological `position` of that message within its conversation,
 * zero-filled whole-conversation role/status counts (the canonical buckets from
 * `/conversations/stats`) and a bounded newest-sibling-first page. The
 * project-name fallback reuses the rule from `/conversations/feed`, so the
 * snapshot cannot disagree with those views.
 *
 * Only messages belonging to the requested conversation contribute to the
 * counts, the `position` and the sibling page; a message id from another
 * conversation is never mistaken for one in this conversation. `counts` describe
 * the whole conversation and are never bounded by `recent_limit`.
 *
 * An unknown conversation is a 404 (`conversation_not_found`) and a message
 * absent from that conversation is a separate 404 (`message_not_found`), both
 * normalized to `undefined` by the transports; a malformed id or an invalid
 * `recent_limit` uses the shared 422 envelope.
 *
 * `lib/messageOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import { UNKNOWN_CONVERSATION_PROJECT_NAME } from "./conversationFeed";
import { MESSAGE_ROLES, MESSAGE_STATUSES } from "./conversationStats";
import type { Conversation, Message, MessageOverview, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/conversations/{id}/messages/{id}/overview` endpoint. */
export interface MessageOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface MessageOverviewSeeds {
  readonly conversations: readonly Conversation[];
  readonly messages: readonly Message[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_MESSAGE_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (both ids must be UUIDs and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. Unknown-but-valid ids are 404s checked by the fetch layer.
 */
export function validateMessageOverviewArgs(
  conversationId: string,
  messageId: string,
  options: MessageOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(conversationId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid conversation id.",
      details: [{ field: "conversation_id", message: "conversation_id must be a valid UUID" }],
    });
  }
  if (!UUID_PATTERN.test(messageId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid message id.",
      details: [{ field: "message_id", message: "message_id must be a valid UUID" }],
    });
  }
  const { recentLimit } = options;
  if (
    recentLimit !== undefined &&
    (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Message overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-message snapshot exactly as the backend repository does.
 * `conversationId` is assumed to exist (the fetch layer rejects unknown
 * conversations). Only messages in that conversation are considered: they are
 * sorted by `(created_at, id)` for the 1-based `position`, counted into
 * zero-filled role/status buckets over the whole set, and emitted newest-first
 * as the bounded sibling page. A message absent from the conversation throws a
 * `message_not_found` 404.
 */
export function deriveMessageOverview(
  conversationId: string,
  messageId: string,
  seeds: MessageOverviewSeeds,
  options: MessageOverviewOptions = {},
): MessageOverview {
  const conversation = seeds.conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) {
    throw new ApiError({
      status: 404,
      code: "conversation_not_found",
      message: `Conversation '${conversationId}' was not found.`,
    });
  }

  const project = seeds.projects.find((candidate) => candidate.id === conversation.project_id);
  const projectName = project?.name ?? UNKNOWN_CONVERSATION_PROJECT_NAME;

  const messages = seeds.messages.filter((message) => message.conversation_id === conversationId);
  const chronological = [...messages].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  const position = chronological.findIndex((message) => message.id === messageId) + 1;
  if (position === 0) {
    throw new ApiError({
      status: 404,
      code: "message_not_found",
      message: `Message '${messageId}' was not found.`,
    });
  }
  const target = chronological[position - 1] as Message;

  const roleCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const message of messages) {
    roleCounts.set(message.role, (roleCounts.get(message.role) ?? 0) + 1);
    const status = message.status ?? "complete";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const counts: MessageOverview["counts"] = {
    total: messages.length,
    by_role: MESSAGE_ROLES.map((role) => ({ role, count: roleCounts.get(role) ?? 0 })),
    by_status: MESSAGE_STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
  };

  const newestFirst = [...messages].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );
  const { recentLimit = DEFAULT_MESSAGE_OVERVIEW_RECENT_LIMIT } = options;

  return {
    message_id: target.id,
    conversation_id: conversation.id,
    conversation_title: conversation.title,
    project_id: conversation.project_id,
    project_name: projectName,
    role: target.role,
    content: target.content,
    // The backend `Message` wire schema defaults status to "complete"; the UI
    // `Message` type keeps it optional, so apply the same default here.
    status: target.status ?? "complete",
    position,
    attachments: target.attachments,
    operation_id: target.operation_id,
    created_at: target.created_at,
    counts,
    recent_siblings: newestFirst.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/conversations/{id}/messages/{id}/overview` request. */
export function messageOverviewQueryParams(
  options: MessageOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
