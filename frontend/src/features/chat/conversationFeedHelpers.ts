/**
 * Display models for the authoritative conversation feed (C133/C135/C136
 * follow-up). The backend derives the newest-first, workspace-wide feed fresh
 * from the authoritative `CONVERSATIONS`/`MESSAGES` stores — the same stores
 * `/conversations` and `/conversations/stats` read — and the mocks transport
 * mirrors that derivation. This module only turns the canonical
 * `ConversationFeed` payload into render-ready rows so the panel JSX stays free
 * of inline mapping and both transports render identically. Every helper
 * tolerates `undefined` (query not settled or failed) and returns render-safe
 * values.
 */

import type { ConversationFeedOptions } from "../../lib/conversationFeed";
import type { ConversationFeed, MessageRole } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/** Render-ready row for one conversation in the feed. */
export interface ConversationFeedRow {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
  readonly messageCount: number;
  readonly messageLabel: string;
  readonly lastMessageRole?: MessageRole | null;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly excerpt: string;
  readonly hasPreview: boolean;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const CONVERSATION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildConversationFeedOptions(
  projectId: string | undefined,
  limit: number,
): ConversationFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

const ROLE_TONE: Readonly<Record<MessageRole, BadgeTone>> = {
  user: "accent",
  assistant: "info",
  system: "neutral",
  tool: "warning",
};

/** Human label for the last-message role, or an explicit empty-conversation label. */
export function conversationFeedRoleLabel(role?: MessageRole | null): string {
  if (!role) return "No messages";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Stable badge tone for the last-message role (neutral for an empty conversation). */
export function conversationFeedRoleTone(role?: MessageRole | null): BadgeTone {
  return role ? ROLE_TONE[role] : "neutral";
}

/** Pluralized message-count label. */
export function conversationFeedMessageLabel(count: number): string {
  return `${count} message${count === 1 ? "" : "s"}`;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(updated_at, conversation_id)`).
 */
export function conversationFeedRows(
  feed: ConversationFeed | undefined,
  now: number = Date.now(),
): readonly ConversationFeedRow[] {
  const items = feed?.items ?? [];
  return items.map((item) => {
    const excerpt = item.last_message_excerpt?.trim() ?? "";
    return {
      id: item.conversation_id,
      conversationId: item.conversation_id,
      projectId: item.project_id,
      projectName: item.project_name,
      title: item.title,
      messageCount: item.message_count,
      messageLabel: conversationFeedMessageLabel(item.message_count),
      lastMessageRole: item.last_message_role,
      roleLabel: conversationFeedRoleLabel(item.last_message_role),
      roleTone: conversationFeedRoleTone(item.last_message_role),
      excerpt: excerpt || "No messages yet",
      hasPreview: excerpt.length > 0,
      timestamp: item.updated_at,
      relativeTime: formatRelative(item.updated_at, now),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all conversations in scope before the `limit` page is applied.
 */
export function conversationFeedSummary(
  rows: readonly ConversationFeedRow[],
  total?: number,
): string {
  if (rows.length === 0) return "No conversations";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} conversation${count === 1 ? "" : "s"} · latest: ${latest?.title ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function conversationFeedGeneratedAtLabel(
  feed: ConversationFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope-aware empty-state copy for the feed. */
export function conversationFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Conversations for this project will appear here."
    : "Conversations will appear here as workspaces start chatting with the studio.";
}
