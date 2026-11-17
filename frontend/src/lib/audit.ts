/**
 * Project audit trail derivation + filtering helpers.
 *
 * The backend (C18) derives the feed from its authoritative asset/job stores;
 * `lib/mock` reproduces that derivation so mock mode stays at feature parity
 * with live mode. Keeping the rules pure and shared also lets the parity guard
 * drive both transports over the exact same seeds.
 */

import type { Asset, AuditEvent, AuditTrail, Job } from "./types";

/** Optional filters mirrored from the authoritative audit endpoint. */
export interface AuditQuery {
  readonly kind?: AuditEvent["kind"];
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
}

/** Kept in sync with JOB_TONE in features/lineage/graphHelpers.ts and the backend repository. */
const JOB_TONES: Record<Job["status"], AuditEvent["tone"]> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  canceled: "neutral",
};

/** Derive the raw, unfiltered feed from assets + jobs (mirrors the backend repository). */
export function deriveAuditEvents(
  assets: readonly Asset[],
  jobs: readonly Job[],
): AuditEvent[] {
  const events: AuditEvent[] = [];
  for (const asset of assets) {
    events.push({
      id: `asset-${asset.id}`,
      kind: "asset",
      label: `Created ${asset.name}`,
      detail: asset.provenance?.operation_id ?? asset.type,
      timestamp: asset.created_at,
      tone: "info",
    });
    const receipt = asset.metadata?.["publish_receipt"];
    if (receipt && typeof receipt === "object") {
      const comment = (receipt as Record<string, unknown>)["comment"];
      events.push({
        id: `publish-${asset.id}`,
        kind: "publish",
        label: `Published ${asset.name}`,
        detail: typeof comment === "string" && comment ? comment : "Publish receipt recorded",
        timestamp: asset.updated_at,
        tone: "success",
      });
    }
  }
  for (const job of jobs) {
    events.push({
      id: `job-${job.id}`,
      kind: "job",
      label: `${job.operation_id} · ${job.status}`,
      detail: job.error?.message ?? `Attempt ${job.attempt ?? 0}`,
      timestamp: job.created_at,
      tone: JOB_TONES[job.status] ?? "neutral",
    });
  }
  return events;
}

/**
 * Filter, order (newest first with an id tiebreak) and cap a feed exactly as the
 * backend repository does, so both transports agree on every combination.
 */
export function filterAuditEvents(
  events: readonly AuditEvent[],
  query: AuditQuery = {},
): AuditEvent[] {
  const { kind, since, until, limit } = query;
  let result = [...events];
  if (kind) result = result.filter((event) => event.kind === kind);
  if (since) result = result.filter((event) => event.timestamp >= since);
  if (until) result = result.filter((event) => event.timestamp <= until);
  result.sort((a, b) => {
    const byTime = b.timestamp.localeCompare(a.timestamp);
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
  });
  return limit === undefined ? result : result.slice(0, limit);
}

/** Derive a complete trail for one project from its assets + jobs. */
export function buildAuditTrail(
  projectId: string,
  assets: readonly Asset[],
  jobs: readonly Job[],
  query: AuditQuery = {},
): AuditTrail {
  const scopedAssets = assets.filter((asset) => asset.project_id === projectId);
  const scopedJobs = jobs.filter((job) => job.project_id === projectId);
  return {
    project_id: projectId,
    events: filterAuditEvents(deriveAuditEvents(scopedAssets, scopedJobs), query),
  };
}

/** Re-filter an already-derived trail (used by the mock + parity seed transports). */
export function filterAuditTrail(
  trail: AuditTrail | undefined,
  query: AuditQuery = {},
): AuditTrail | undefined {
  if (!trail) return undefined;
  return { ...trail, events: filterAuditEvents(trail.events ?? [], query) };
}

/** Query-string values for the live `/projects/{id}/audit` request. */
export function auditQueryParams(
  query: AuditQuery = {},
): Record<string, string | number | undefined> {
  return {
    kind: query.kind,
    since: query.since,
    until: query.until,
    limit: query.limit,
  };
}
