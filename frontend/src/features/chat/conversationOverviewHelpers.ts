/**
 * Display models for the authoritative single-conversation overview (C209/C211/C212
 * follow-up). Every value rendered by `ConversationOverviewPanel` is derived here
 * from the raw `ConversationOverview` snapshot so loading/error/missing/empty/
 * populated states stay consistent across mock and live transports and the JSX
 * stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown
 * conversation) and return zero-filled, render-safe values. Role/status
 * breakdowns reuse the canonical `conversationStatsHelpers` projections so the
 * overview can never drift from the workspace conversation-stats view.
 */

import type {
  ConversationOverview,
  ConversationStats,
  Message,
  MessageRole,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import {
  conversationFeedMessageLabel,
  conversationFeedRoleLabel,
  conversationFeedRoleTone,
} from "./conversationFeedHelpers";
import {
  conversationRoleRows,
  conversationStatusRows,
  humanizeLabel,
  type ConversationRoleRow,
  type ConversationStatusRow,
} from "./conversationStatsHelpers";

export interface ConversationOverviewIdentity {
  readonly title: string;
  readonly projectLabel: string;
  readonly lastMessageRole?: MessageRole | null;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly excerpt: string;
  readonly hasPreview: boolean;
  readonly messageLabel: string;
  readonly createdLabel: string;
  readonly updatedLabel: string;
}

export interface ConversationOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ConversationOverviewRecentMessage {
  readonly id: string;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly statusLabel: string;
  readonly content: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function conversationOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function conversationOverviewGeneratedAtLabel(
  overview?: ConversationOverview | null,
  now: number = Date.now(),
): string {
  return conversationOverviewRelativeLabel(overview?.generated_at, now);
}

/**
 * Authoritative message total, preferring `counts.total` (never page-bounded)
 * over the denormalized `message_count`; zero-filled when neither is valid.
 */
export function conversationOverviewMessageCount(
  overview?: ConversationOverview | null,
): number {
  const raw = overview?.counts?.total ?? overview?.message_count;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

/** Trimmed last-message excerpt with an explicit empty-conversation fallback. */
export function conversationOverviewExcerpt(value?: string | null): string {
  return value?.trim() || "No messages yet";
}

/** Identity badges, last-message preview and recency for the snapshot header. */
export function conversationOverviewIdentity(
  overview?: ConversationOverview | null,
  now: number = Date.now(),
): ConversationOverviewIdentity {
  const role = overview?.last_message_role;
  return {
    title: overview?.title || "Untitled conversation",
    projectLabel: overview?.project_name || "",
    lastMessageRole: role,
    roleLabel: conversationFeedRoleLabel(role),
    roleTone: conversationFeedRoleTone(role),
    excerpt: conversationOverviewExcerpt(overview?.last_message_excerpt),
    hasPreview: Boolean(overview?.last_message_excerpt?.trim()),
    messageLabel: conversationFeedMessageLabel(conversationOverviewMessageCount(overview)),
    createdLabel: conversationOverviewRelativeLabel(overview?.created_at, now),
    updatedLabel: conversationOverviewRelativeLabel(overview?.updated_at, now),
  };
}

/** The three headline conversation counters, in a stable display order. */
export function conversationOverviewStatRows(
  overview?: ConversationOverview | null,
  now: number = Date.now(),
): ConversationOverviewStat[] {
  const role = overview?.last_message_role;
  return [
    {
      key: "messages",
      label: "Messages",
      value: String(conversationOverviewMessageCount(overview)),
      hint: "In this conversation",
    },
    {
      key: "last_role",
      label: "Last message",
      value: role ? conversationFeedRoleLabel(role) : "—",
      hint: "Most recent author",
    },
    {
      key: "updated",
      label: "Updated",
      value: conversationOverviewRelativeLabel(overview?.updated_at, now) || "—",
      hint: "Newest activity",
    },
  ];
}

/** Bridge the overview's counts into the canonical stats shape for reuse. */
function asConversationStats(overview?: ConversationOverview | null): ConversationStats {
  return {
    total_conversations: overview ? 1 : 0,
    total_messages: conversationOverviewMessageCount(overview),
    by_role: overview?.counts?.by_role,
    by_status: overview?.counts?.by_status,
    generated_at: overview?.generated_at ?? "",
  };
}

/** Zero-filled message-role distribution shared with the stats view. */
export function conversationOverviewRoleRows(
  overview?: ConversationOverview | null,
): ConversationRoleRow[] {
  return conversationRoleRows(asConversationStats(overview));
}

/** Zero-filled delivery-status distribution shared with the stats view. */
export function conversationOverviewStatusRows(
  overview?: ConversationOverview | null,
): ConversationStatusRow[] {
  return conversationStatusRows(asConversationStats(overview));
}

/** Newest-first recent messages projected into render-safe rows. */
export function conversationOverviewRecentMessages(
  overview?: ConversationOverview | null,
  now: number = Date.now(),
): ConversationOverviewRecentMessage[] {
  return (overview?.recent_messages ?? []).map((message: Message) => ({
    id: message.id,
    roleLabel: humanizeLabel(message.role),
    roleTone: conversationFeedRoleTone(message.role),
    statusLabel: message.status ? humanizeLabel(message.status) : "—",
    content: message.content?.trim() || "—",
    timestamp: message.created_at,
    relativeTime: conversationOverviewRelativeLabel(message.created_at, now),
  }));
}

/** False only when the snapshot is missing or entirely empty. */
export function hasConversationOverviewData(overview?: ConversationOverview | null): boolean {
  if (!overview) return false;
  return (
    conversationOverviewMessageCount(overview) > 0 ||
    (overview.recent_messages?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function conversationOverviewSummaryLabel(
  overview?: ConversationOverview | null,
): string {
  if (!overview) return "";
  const total = conversationOverviewMessageCount(overview);
  const base = `${total} message${total === 1 ? "" : "s"}`;
  const excerpt = conversationOverviewExcerpt(overview.last_message_excerpt);
  return excerpt === "No messages yet" ? base : `${base} · ${excerpt}`;
}
