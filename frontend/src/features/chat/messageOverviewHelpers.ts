/**
 * Display models for the authoritative single conversation-message overview
 * (C270/C272/C273 follow-up). Every value rendered by `MessageOverviewPanel` is
 * derived here from the raw `MessageOverview` snapshot so loading/error/missing/
 * empty/populated states stay consistent across mock and live transports and the
 * JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown message)
 * and return zero-filled, render-safe values. Role/status breakdowns and role
 * badges reuse the canonical conversation-stats/feed projections so this panel
 * can never drift from the other conversation views. The picker options mirror
 * the chronological order of `useMessages`, the same authoritative source the
 * Chat thread renders.
 */

import type { MessageOverviewOptions } from "../../lib/messageOverview";
import type {
  ConversationStats,
  Message,
  MessageOverview,
  MessageOverviewCounts,
  MessageStatus,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { conversationFeedRoleLabel, conversationFeedRoleTone } from "./conversationFeedHelpers";
import {
  conversationRoleRows,
  conversationStatusRows,
  humanizeLabel,
  type ConversationRoleRow,
  type ConversationStatusRow,
} from "./conversationStatsHelpers";

/** Page bound used for the bounded sibling list (counts are never bounded). */
export const MESSAGE_OVERVIEW_RECENT_LIMIT = 5;

/** Page-size chips offered above the sibling list. */
export const MESSAGE_OVERVIEW_LIMITS: readonly number[] = [5, 10, 25];

const STATUS_TONE: Readonly<Record<MessageStatus, BadgeTone>> = {
  pending: "warning",
  streaming: "info",
  complete: "success",
  error: "danger",
};

export interface MessageOverviewIdentity {
  readonly messageLabel: string;
  readonly conversationTitle: string;
  readonly projectLabel: string;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly positionLabel: string;
  readonly contentPreview: string;
  readonly createdLabel: string;
  readonly operationLabel: string;
  readonly attachmentLabel: string;
}

export interface MessageOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface MessageOverviewSibling {
  readonly id: string;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly statusLabel: string;
  readonly contentPreview: string;
  readonly timestamp: string;
  readonly relativeTime: string;
  readonly isCurrent: boolean;
}

export interface MessageOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly messageId: string;
}

/** Hook query options for the bounded sibling page. */
export function buildMessageOverviewOptions(
  recentLimit: number = MESSAGE_OVERVIEW_RECENT_LIMIT,
): MessageOverviewOptions {
  return { recentLimit };
}

/** One whole-conversation count, zero-filled when the snapshot is absent. */
export function messageOverviewCount(
  overview?: MessageOverview | null,
  key: keyof MessageOverviewCounts = "total",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Short relative label for a timestamp, or "" when absent. */
export function messageOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function messageOverviewGeneratedAtLabel(
  overview?: MessageOverview | null,
  now: number = Date.now(),
): string {
  return messageOverviewRelativeLabel(overview?.generated_at, now);
}

/** Short id label for a message or operation badge, with an explicit fallback. */
export function messageOverviewShortId(value?: string | null, prefix = "Message"): string {
  if (!value) return "";
  return value.length > 10 ? `${prefix} ${value.slice(0, 8)}…` : value;
}

/** Whitespace-normalized, truncated single-line preview of message content. */
export function messageOverviewContentPreview(value?: string | null, max = 140): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return "No content";
  return normalized.length > max ? `${normalized.slice(0, max).trimEnd()}…` : normalized;
}

/** Human label for a delivery status, tolerant of an unexpected wire value. */
export function messageOverviewStatusLabel(status?: MessageStatus | null): string {
  return status ? humanizeLabel(status) : "—";
}

/** Badge tone for a delivery status, tolerant of an unexpected wire value. */
export function messageOverviewStatusTone(status?: MessageStatus | null): BadgeTone {
  return status && STATUS_TONE[status] ? STATUS_TONE[status] : "neutral";
}

/** 1-based chronological position label for the selected message. */
export function messageOverviewPositionLabel(position?: number | null): string {
  return typeof position === "number" && Number.isFinite(position) && position >= 1
    ? `#${position}`
    : "—";
}

/** Identity badges, content preview and recency for the snapshot header. */
export function messageOverviewIdentity(
  overview?: MessageOverview | null,
  now: number = Date.now(),
): MessageOverviewIdentity {
  const attachments = overview?.attachments?.length ?? 0;
  return {
    messageLabel: messageOverviewShortId(overview?.message_id, "Message"),
    conversationTitle: overview?.conversation_title || "Untitled conversation",
    projectLabel: overview?.project_name || "",
    roleLabel: conversationFeedRoleLabel(overview?.role),
    roleTone: conversationFeedRoleTone(overview?.role),
    statusLabel: messageOverviewStatusLabel(overview?.status),
    statusTone: messageOverviewStatusTone(overview?.status),
    positionLabel: messageOverviewPositionLabel(overview?.position),
    contentPreview: messageOverviewContentPreview(overview?.content),
    createdLabel: messageOverviewRelativeLabel(overview?.created_at, now),
    operationLabel: messageOverviewShortId(overview?.operation_id, "Operation"),
    attachmentLabel: attachments > 0 ? `${attachments} attachment${attachments === 1 ? "" : "s"}` : "",
  };
}

/** The four headline message counters, in a stable display order. */
export function messageOverviewStatRows(
  overview?: MessageOverview | null,
  now: number = Date.now(),
): MessageOverviewStat[] {
  return [
    {
      key: "messages",
      label: "Messages",
      value: String(messageOverviewCount(overview)),
      hint: "In this conversation",
    },
    {
      key: "position",
      label: "Position",
      value: messageOverviewPositionLabel(overview?.position),
      hint: "Chronological in thread",
    },
    {
      key: "created",
      label: "Sent",
      value: messageOverviewRelativeLabel(overview?.created_at, now) || "—",
      hint: "Message created",
    },
    {
      key: "attachments",
      label: "Attachments",
      value: String(overview?.attachments?.length ?? 0),
      hint: "Linked assets",
    },
  ];
}

/** Bridge the overview counts into the canonical stats shape for reuse. */
function asConversationStats(overview?: MessageOverview | null): ConversationStats {
  return {
    total_conversations: overview ? 1 : 0,
    total_messages: messageOverviewCount(overview),
    by_role: overview?.counts?.by_role,
    by_status: overview?.counts?.by_status,
    generated_at: overview?.generated_at ?? "",
  };
}

/** Zero-filled message-role distribution shared with the stats view. */
export function messageOverviewRoleRows(
  overview?: MessageOverview | null,
): ConversationRoleRow[] {
  return conversationRoleRows(asConversationStats(overview));
}

/** Zero-filled delivery-status distribution shared with the stats view. */
export function messageOverviewStatusRows(
  overview?: MessageOverview | null,
): ConversationStatusRow[] {
  return conversationStatusRows(asConversationStats(overview));
}

/** Newest-first sibling messages projected into render-safe rows. */
export function messageOverviewRecentSiblings(
  overview?: MessageOverview | null,
  now: number = Date.now(),
): MessageOverviewSibling[] {
  return (overview?.recent_siblings ?? []).map((message: Message) => ({
    id: message.id,
    roleLabel: conversationFeedRoleLabel(message.role),
    roleTone: conversationFeedRoleTone(message.role),
    statusLabel: messageOverviewStatusLabel(message.status),
    contentPreview: messageOverviewContentPreview(message.content),
    timestamp: message.created_at,
    relativeTime: messageOverviewRelativeLabel(message.created_at, now),
    isCurrent: message.id === overview?.message_id,
  }));
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasMessageOverviewData(overview?: MessageOverview | null): boolean {
  if (!overview) return false;
  return messageOverviewCount(overview) > 0 || (overview.recent_siblings?.length ?? 0) > 0;
}

/** One-line summary for the panel header/footer. */
export function messageOverviewSummaryLabel(overview?: MessageOverview | null): string {
  if (!overview) return "";
  const total = messageOverviewCount(overview);
  const position = messageOverviewPositionLabel(overview.position);
  return `${total} message${total === 1 ? "" : "s"} · selected ${position}`;
}

/** Scope-aware empty-state copy for the message picker. */
export function messageOverviewEmptyDescription(conversationScoped: boolean): string {
  return conversationScoped
    ? "Messages in this conversation will appear here."
    : "Select a conversation with messages to inspect its snapshots.";
}

/**
 * Picker options derived from the authoritative Chat message list. Chronological
 * `(created_at, id)` order matches the overview's 1-based `position`, so the
 * picker label agrees with the snapshot it resolves.
 */
export function messageOverviewPickerOptions(
  messages: readonly Message[] | undefined,
): MessageOverviewPickerOption[] {
  const chronological = [...(messages ?? [])].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  return chronological.map((message, index) => ({
    value: message.id,
    label: `#${index + 1} ${conversationFeedRoleLabel(message.role)} · ${messageOverviewContentPreview(message.content, 60)}`,
    messageId: message.id,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function messageOverviewActiveOption(
  options: readonly MessageOverviewPickerOption[],
  selectedValue: string,
): MessageOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
