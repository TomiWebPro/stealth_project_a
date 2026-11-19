/**
 * Authoritative conversation feed derivation + query helpers (C133 follow-up).
 *
 * The backend (`ConversationFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of conversations fresh from the authoritative
 * `CONVERSATIONS` collection — the same store `/conversations` lists and
 * `/conversations/stats` reads — so the feed can never drift from those views or
 * from what actually exists. Each item's project display name is joined from the
 * authoritative project store (with a stable fallback for a missing project),
 * and its last-message preview (role + truncated single-line excerpt, or `null`
 * for an empty conversation) is derived from the most recent `MESSAGES` record
 * with a deterministic `(created_at, message_id)` tie-break. Ordering is by
 * descending `(updated_at, conversation_id)` so the wire shape is byte-for-byte
 * identical across the in-memory and SQLite stores, and `total` counts the whole
 * filtered feed before the `limit` page is applied.
 *
 * `lib/conversationFeed` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Conversation, ConversationFeed, ConversationFeedItem, Message, Project } from "./types";

/** Optional scope + page bounds mirrored from the authoritative `/conversations/feed` endpoint. */
export interface ConversationFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when a conversation's project is missing. */
export const UNKNOWN_CONVERSATION_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const EXCERPT_CHARS = 160;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateConversationFeedArgs(options: ConversationFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/** Trim and collapse whitespace, then truncate to the backend's fixed excerpt width. */
function excerpt(content: string): string {
  const cleaned = content.trim().split(/\s+/).join(" ");
  return cleaned.length <= EXCERPT_CHARS ? cleaned : cleaned.slice(0, EXCERPT_CHARS) + "…";
}

/**
 * Derive the conversation feed exactly as the backend repository does: project
 * each conversation, optionally scope to one project, join project names (falling
 * back to a stable display name for missing projects), resolve the newest message
 * per conversation, sort newest-first with a conversation-id tie-break and apply
 * the `limit` page. `total` counts the whole filtered feed before paging. An empty
 * scope yields an empty feed (never an error).
 */
export function deriveConversationFeed(
  conversations: readonly Conversation[],
  messages: readonly Message[],
  projects: readonly Project[],
  now: string,
  options: ConversationFeedOptions = {},
): ConversationFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  // Most recent message per conversation, with a deterministic tie-break.
  const lastMessages = new Map<string, Message>();
  for (const message of messages) {
    const current = lastMessages.get(message.conversation_id);
    if (
      !current ||
      message.created_at > current.created_at ||
      (message.created_at === current.created_at && message.id > current.id)
    ) {
      lastMessages.set(message.conversation_id, message);
    }
  }

  const items: ConversationFeedItem[] = [];
  for (const conversation of conversations) {
    if (projectId !== undefined && conversation.project_id !== projectId) continue;
    const last = lastMessages.get(conversation.id);
    items.push({
      conversation_id: conversation.id,
      project_id: conversation.project_id,
      project_name: projectNames.get(conversation.project_id) ?? UNKNOWN_CONVERSATION_PROJECT_NAME,
      title: conversation.title,
      message_count: conversation.message_count ?? 0,
      last_message_role: last?.role ?? null,
      last_message_excerpt: last ? excerpt(last.content) : null,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
    });
  }

  items.sort(
    (a, b) =>
      b.updated_at.localeCompare(a.updated_at) ||
      b.conversation_id.localeCompare(a.conversation_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/conversations/feed` request. */
export function conversationFeedQueryParams(
  options: ConversationFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
