/**
 * Display models for the authoritative conversation/message statistics (C45/C47
 * follow-up). Every value rendered by `ConversationStatsPanel` is derived here
 * from the raw `ConversationStats` payload so empty, partial and populated
 * states stay consistent across mock and live transports and JSX stays free of
 * inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Role/status orders mirror the canonical
 * `MESSAGE_ROLES`/`MESSAGE_STATUSES` in `lib/conversationStats` so the UI always
 * shows a complete zero-filled breakdown.
 */

import type { ConversationStats, MessageRole, MessageStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export interface ConversationStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ConversationRoleRow {
  readonly role: MessageRole;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all messages, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ConversationStatusRow {
  readonly status: MessageStatus;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all messages, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

const ROLE_ORDER: readonly MessageRole[] = ["system", "user", "assistant", "tool"];
const STATUS_ORDER: readonly MessageStatus[] = ["pending", "streaming", "complete", "error"];

const ROLE_TONE: Readonly<Record<MessageRole, BadgeTone>> = {
  user: "accent",
  assistant: "info",
  system: "neutral",
  tool: "warning",
};

const STATUS_TONE: Readonly<Record<MessageStatus, BadgeTone>> = {
  pending: "warning",
  streaming: "info",
  complete: "success",
  error: "danger",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Capitalize a role/status token for a compact badge label. */
export function humanizeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Format a mean that may be absent; the backend rounds to 3 decimals. */
export function formatAverageMessages(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return String(Number(value.toFixed(3)));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function statsRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The four authoritative counters, in a stable display order. */
export function conversationStatsCards(
  stats?: ConversationStats,
  now: number = Date.now(),
): ConversationStatsStat[] {
  return [
    {
      key: "conversations",
      label: "Conversations",
      value: String(stats?.total_conversations ?? 0),
      hint: "In scope",
    },
    {
      key: "messages",
      label: "Messages",
      value: String(stats?.total_messages ?? 0),
      hint: "Across conversations",
    },
    {
      key: "average",
      label: "Avg messages",
      value: formatAverageMessages(stats?.average_messages_per_conversation),
      hint: "Per conversation",
    },
    {
      key: "last_activity",
      label: "Last activity",
      value: statsRelativeLabel(stats?.last_activity_at, now) || "—",
      hint: "Newest conversation",
    },
  ];
}

/** Zero-filled message-role distribution with a share per role. */
export function conversationRoleRows(stats?: ConversationStats): ConversationRoleRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_role ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.role, entry.count);
  }
  const total = ROLE_ORDER.reduce((sum, role) => sum + (counts.get(role) ?? 0), 0);
  return ROLE_ORDER.map((role) => {
    const count = counts.get(role) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      role,
      label: humanizeLabel(role),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: ROLE_TONE[role],
    };
  });
}

/** Zero-filled delivery-status distribution with a share per status. */
export function conversationStatusRows(stats?: ConversationStats): ConversationStatusRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_status ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.status, entry.count);
  }
  const total = STATUS_ORDER.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      status,
      label: humanizeLabel(status),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: STATUS_TONE[status],
    };
  });
}

/** True when the snapshot carries at least one conversation or message. */
export function hasConversationStatsData(stats?: ConversationStats): boolean {
  if (!stats) return false;
  return (
    stats.total_conversations > 0 ||
    stats.total_messages > 0 ||
    (stats.by_role?.some((row) => row && row.count > 0) ?? false)
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function conversationStatsGeneratedAtLabel(
  stats?: ConversationStats,
  now: number = Date.now(),
): string {
  return statsRelativeLabel(stats?.generated_at, now);
}
