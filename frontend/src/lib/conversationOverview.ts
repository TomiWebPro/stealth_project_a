/**
 * Authoritative single-conversation overview derivation + query helpers (C209
 * follow-up).
 *
 * The backend (`ConversationOverviewRepository`) derives the whole snapshot
 * fresh from its authoritative conversation and message stores on every call —
 * there is no second index. It projects one conversation's identity, zero-filled
 * message role/status counts, a last-message preview (reusing the
 * `/conversations/feed` excerpt rule) and a bounded newest-message-first list.
 *
 * `lib/conversationOverview` reproduces that derivation over the same seeds so
 * mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over identical data. The role/status buckets reuse the
 * canonical values from `/conversations/stats` and the excerpt rule from
 * `/conversations/feed`, so the snapshot cannot disagree with those views.
 *
 * An unknown conversation is a 404 checked by the fetch layer against the
 * conversation seeds (resolved to `undefined` by the transports); a malformed id
 * or an out-of-range `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import { excerpt as conversationExcerpt } from "./conversationFeed";
import { UNKNOWN_CONVERSATION_PROJECT_NAME } from "./conversationFeed";
import { MESSAGE_ROLES, MESSAGE_STATUSES } from "./conversationStats";
import type { Conversation, ConversationOverview, Message, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/conversations/{id}/overview` endpoint. */
export interface ConversationOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface ConversationOverviewSeeds {
  readonly conversations: readonly Conversation[];
  readonly messages: readonly Message[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_CONVERSATION_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`conversation_id` UUID and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid conversation is a 404 checked by the fetch
 * layer.
 */
export function validateConversationOverviewArgs(
  conversationId: string,
  options: ConversationOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(conversationId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid conversation id.",
      details: [{ field: "conversation_id", message: "conversation_id must be a valid UUID" }],
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
      message: "Conversation overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-conversation snapshot exactly as the backend repository does.
 * `conversationId` is assumed to exist (the fetch layer rejects unknown
 * conversations); an unseeded conversation yields a 404. Messages are sorted
 * newest-first with an `(created_at, id)` tie-break; zero-filled role/status
 * buckets and the last-message preview come from the whole message set, never
 * from the bounded recent page.
 */
export function deriveConversationOverview(
  conversationId: string,
  seeds: ConversationOverviewSeeds,
  options: ConversationOverviewOptions = {},
): ConversationOverview {
  const conversation = seeds.conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) {
    throw new ApiError({ status: 404, code: "not_found", message: "Conversation not found." });
  }

  const { recentLimit = DEFAULT_CONVERSATION_OVERVIEW_RECENT_LIMIT } = options;
  const project = seeds.projects.find((candidate) => candidate.id === conversation.project_id);
  const projectName = project?.name ?? UNKNOWN_CONVERSATION_PROJECT_NAME;

  const messages = seeds.messages
    .filter((message) => message.conversation_id === conversationId)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );

  const roleCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const message of messages) {
    roleCounts.set(message.role, (roleCounts.get(message.role) ?? 0) + 1);
    if (message.status) {
      statusCounts.set(message.status, (statusCounts.get(message.status) ?? 0) + 1);
    }
  }

  const counts = {
    total: messages.length,
    by_role: MESSAGE_ROLES.map((role) => ({ role, count: roleCounts.get(role) ?? 0 })),
    by_status: MESSAGE_STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
  };

  const last = messages[0];

  return {
    conversation_id: conversation.id,
    project_id: conversation.project_id,
    project_name: projectName,
    title: conversation.title,
    created_by: conversation.created_by,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    message_count: conversation.message_count ?? 0,
    last_message_role: last?.role ?? null,
    last_message_excerpt: last ? conversationExcerpt(last.content) : null,
    counts,
    recent_messages: messages.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/conversations/{id}/overview` request. */
export function conversationOverviewQueryParams(
  options: ConversationOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
