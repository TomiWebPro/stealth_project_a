/**
 * Authoritative project audit trail contracts.
 * Mirrors backend/app/schemas/audit.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

export type AuditEventKind = "asset" | "publish" | "job";

/** Mirrors the UI BadgeTone union so an event tone can drive a badge directly. */
export type AuditTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** One immutable entry in a project's history (id is `<kind>-<entity-id>`). */
export interface AuditEvent {
  id: string;
  kind: AuditEventKind;
  label: string;
  detail: string;
  timestamp: Timestamp;
  tone: AuditTone;
}

/** Newest-first audit feed for one project. */
export interface AuditTrail {
  project_id: Uuid;
  events?: AuditEvent[];
}
