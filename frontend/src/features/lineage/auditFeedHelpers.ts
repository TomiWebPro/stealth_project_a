import type { AuditEvent, AuditEventKind, AuditTone, AuditTrail } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/**
 * Display model for the authoritative project audit feed (C20b). Every value the
 * panel renders is derived here so JSX stays free of inline mapping and the
 * empty/populated states are identical across mock and live transports.
 */
export interface AuditFeedItem {
  readonly id: string;
  readonly kind: AuditEventKind;
  readonly label: string;
  readonly detail: string;
  readonly timestamp: string;
  readonly tone: BadgeTone;
  readonly relativeTime: string;
}

/** The canonical `AuditTone` union intentionally matches `BadgeTone` one-to-one. */
const BADGE_TONE: Readonly<Record<AuditTone, BadgeTone>> = {
  neutral: "neutral",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export interface AuditKindFilter {
  readonly value: AuditEventKind | "all";
  readonly label: string;
}

/** Kind chips shown above the feed; "all" leaves the query unfiltered. */
export const AUDIT_KIND_FILTERS: readonly AuditKindFilter[] = [
  { value: "all", label: "All" },
  { value: "asset", label: "Assets" },
  { value: "publish", label: "Publish" },
  { value: "job", label: "Jobs" },
];

/** Map a canonical `AuditTrail` payload to render-ready rows (newest first). */
export function auditFeedItems(trail: AuditTrail | undefined): readonly AuditFeedItem[] {
  const events: readonly AuditEvent[] = trail?.events ?? [];
  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    label: event.label,
    detail: event.detail,
    timestamp: event.timestamp,
    tone: BADGE_TONE[event.tone] ?? "neutral",
    relativeTime: formatRelative(event.timestamp),
  }));
}

/** Short description for the feed header, derived from the visible rows. */
export function auditFeedSummary(items: readonly AuditFeedItem[]): string {
  if (items.length === 0) return "No audit events";
  const latest = items[0];
  return `${items.length} event${items.length === 1 ? "" : "s"} · latest: ${latest?.label ?? "—"}`;
}
