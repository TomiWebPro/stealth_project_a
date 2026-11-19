/**
 * Display models for the authoritative project feed (C145/C147/C148 follow-up).
 *
 * The backend derives the newest-first, workspace-wide feed fresh from the
 * authoritative `PROJECTS` collection — the same store `/projects` lists and
 * `/projects/stats` aggregates — and the mocks transport mirrors that
 * derivation. This module only turns the canonical `ProjectFeed` payload into
 * render-ready rows so the panel JSX stays free of inline mapping and both
 * transports render identically. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 *
 * Unlike resource feeds scoped by resource id, this feed is scoped by
 * organization (`orgId`) rather than by project, mirroring `/projects/feed`.
 */

import type { ProjectFeedOptions } from "../../lib/projectFeed";
import type { ProjectFeed, ProjectFeedItem, ProjectLifecycle } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/** Render-ready row for one project in the feed. */
export interface ProjectFeedRow {
  readonly id: string;
  readonly projectId: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly name: string;
  readonly descriptionLabel: string;
  readonly lifecycle: ProjectLifecycle;
  readonly lifecycleLabel: string;
  readonly lifecycleTone: BadgeTone;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const PROJECT_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Lifecycle chips offered above the feed; `undefined` means "all lifecycles". */
export const PROJECT_FEED_LIFECYCLE_FILTERS: readonly (ProjectLifecycle | undefined)[] = [
  undefined,
  "active",
  "archived",
];

/** Hook query options from the active org/lifecycle scope and page size. */
export function buildProjectFeedOptions(
  orgId: string | undefined,
  lifecycle: ProjectLifecycle | undefined,
  limit: number,
): ProjectFeedOptions {
  return {
    ...(orgId ? { orgId } : {}),
    ...(lifecycle ? { lifecycle } : {}),
    limit,
  };
}

/** Human label for a lifecycle chip (`undefined` is the unfiltered "All" chip). */
export function projectFeedLifecycleChipLabel(lifecycle: ProjectLifecycle | undefined): string {
  return lifecycle ? projectFeedLifecycleLabel(lifecycle) : "All";
}

/** Friendly lifecycle label derived from the canonical lifecycle value. */
export function projectFeedLifecycleLabel(lifecycle: ProjectLifecycle): string {
  return lifecycle === "archived" ? "Archived" : "Active";
}

/** Badge tone for a project lifecycle, matching the Projects list screen. */
export function projectFeedLifecycleTone(lifecycle: ProjectLifecycle): BadgeTone {
  return lifecycle === "archived" ? "neutral" : "success";
}

/** Defensive description label for a project without a meaningful description. */
export function projectFeedDescriptionLabel(description?: string | null): string {
  const trimmed = description?.trim();
  return trimmed ? trimmed : "No description";
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(created_at, project_id)`).
 */
export function projectFeedRows(
  feed: ProjectFeed | undefined,
  now: number = Date.now(),
): readonly ProjectFeedRow[] {
  const items: readonly ProjectFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.project_id,
    projectId: item.project_id,
    orgId: item.org_id,
    orgName: item.org_name,
    name: item.name,
    descriptionLabel: projectFeedDescriptionLabel(item.description),
    lifecycle: item.lifecycle,
    lifecycleLabel: projectFeedLifecycleLabel(item.lifecycle),
    lifecycleTone: projectFeedLifecycleTone(item.lifecycle),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all projects in scope before the `limit` page is applied.
 */
export function projectFeedSummary(rows: readonly ProjectFeedRow[], total?: number): string {
  if (rows.length === 0) return "No projects";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} project${count === 1 ? "" : "s"} · latest: ${latest?.name ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function projectFeedGeneratedAtLabel(
  feed: ProjectFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function projectFeedEmptyDescription(
  orgScoped: boolean,
  lifecycleFiltered: boolean,
): string {
  if (lifecycleFiltered) {
    return "No projects match this lifecycle filter. Try a different lifecycle or clear it.";
  }
  return orgScoped
    ? "Projects in this organization will appear here."
    : "Projects will appear here as they are created in the studio.";
}
