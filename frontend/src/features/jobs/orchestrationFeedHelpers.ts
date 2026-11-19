/**
 * Display models for the authoritative orchestration feed (C181/C183/C184
 * follow-up). The backend derives the newest-first, workspace-wide feed fresh
 * from the two authoritative orchestration collections — the same stores
 * `/orchestration/*` writes and `/orchestration/stats` aggregates — and the mocks
 * transport mirrors that derivation. This module only turns the canonical
 * `OrchestrationFeed` payload into render-ready rows so the panel JSX stays free
 * of inline mapping and both transports render identically. Every helper
 * tolerates `undefined` (query not settled / failed) and returns render-safe
 * values.
 */

import type { OrchestrationFeedOptions } from "../../lib/orchestrationFeed";
import type {
  OrchestrationFeed,
  OrchestrationFeedItem,
  OrchestrationFeedKind,
  OrchestrationStage,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/** Render-ready row for one plan or run in the authoritative feed. */
export interface OrchestrationFeedRow {
  readonly id: string;
  readonly shortId: string;
  readonly kind: OrchestrationFeedKind;
  readonly kindLabel: string;
  readonly kindTone: BadgeTone;
  readonly projectId: string;
  readonly projectName: string;
  /** Goal (plan) or lifecycle stage (run), ready for display. */
  readonly detailLabel: string;
  /** Lifecycle stage label for run rows; empty for plan rows. */
  readonly stageLabel: string;
  /** Lifecycle stage badge tone for run rows; undefined for plan rows. */
  readonly stageTone: BadgeTone | undefined;
  readonly stepCount: number;
  readonly jobCount: number;
  readonly countsLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const ORCHESTRATION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Orchestration-record-kind chips; `undefined` is the unfiltered "All" chip. */
export const ORCHESTRATION_FEED_KIND_FILTERS: readonly (OrchestrationFeedKind | undefined)[] = [
  undefined,
  "plan",
  "run",
];

const STAGE_LABEL: Readonly<Record<OrchestrationStage, string>> = {
  plan: "Plan",
  resolve: "Resolve",
  submit: "Submit",
  await: "Await",
  collect: "Collect",
  done: "Done",
};

const STAGE_TONE: Readonly<Record<OrchestrationStage, BadgeTone>> = {
  plan: "info",
  resolve: "accent",
  submit: "info",
  await: "warning",
  collect: "accent",
  done: "success",
};

/** Hook query options from the active project/kind scope and page size. */
export function buildOrchestrationFeedOptions(
  projectId: string | undefined,
  kind: OrchestrationFeedKind | undefined,
  limit: number,
): OrchestrationFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    ...(kind ? { kind } : {}),
    limit,
  };
}

/** Human label for a kind chip (`undefined` is the unfiltered "All" chip). */
export function orchestrationFeedKindChipLabel(kind: OrchestrationFeedKind | undefined): string {
  if (!kind) return "All";
  return kind === "plan" ? "Plans" : "Runs";
}

/** Badge tone for a canonical orchestration feed kind. */
export function orchestrationFeedKindTone(kind: OrchestrationFeedKind): BadgeTone {
  return kind === "run" ? "accent" : "info";
}

/** Short, stable fallback for a plan/run with no usable id. */
export function shortOrchestrationFeedId(id: string | undefined): string {
  if (typeof id !== "string" || id === "") return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Stable fallback for a joined project name missing from the payload. */
export function orchestrationFeedProjectName(name: string | undefined): string {
  return typeof name === "string" && name.trim() !== "" ? name : "Unknown project";
}

/** Defensive non-negative count for a possibly malformed feed field. */
function renderCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Compact "N steps · M jobs" label for an item row. */
export function orchestrationFeedCountsLabel(steps: unknown, jobs: unknown): string {
  const stepCount = renderCount(steps);
  const jobCount = renderCount(jobs);
  return `${stepCount} step${stepCount === 1 ? "" : "s"} · ${jobCount} job${
    jobCount === 1 ? "" : "s"
  }`;
}

/** Human label for a canonical lifecycle stage. */
export function orchestrationStageLabel(stage: OrchestrationStage): string {
  return STAGE_LABEL[stage] ?? stage;
}

/** Badge tone for a canonical lifecycle stage. */
export function orchestrationStageTone(stage: OrchestrationStage): BadgeTone {
  return STAGE_TONE[stage] ?? "neutral";
}

/**
 * Secondary detail line for a row: a plan's goal when present, otherwise the
 * run's lifecycle stage, with stable fallbacks for partial payloads.
 */
export function orchestrationFeedDetailLabel(item: OrchestrationFeedItem): string {
  if (item.kind === "plan") {
    const goal = typeof item.goal === "string" ? item.goal.trim() : "";
    return goal || "Plan";
  }
  return item.stage ? orchestrationStageLabel(item.stage) : "Run";
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(created_at, kind, id)`).
 */
export function orchestrationFeedRows(
  feed: OrchestrationFeed | undefined,
  now: number = Date.now(),
): readonly OrchestrationFeedRow[] {
  const items: readonly OrchestrationFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const stepCount = renderCount(item.step_count);
    const jobCount = renderCount(item.job_count);
    const stageTone = item.kind === "run" && item.stage ? orchestrationStageTone(item.stage) : undefined;
    return {
      id: item.id,
      shortId: shortOrchestrationFeedId(item.id),
      kind: item.kind,
      kindLabel: item.kind === "plan" ? "Plan" : "Run",
      kindTone: orchestrationFeedKindTone(item.kind),
      projectId: item.project_id,
      projectName: orchestrationFeedProjectName(item.project_name),
      detailLabel: orchestrationFeedDetailLabel(item),
      stageLabel: stageTone ? orchestrationStageLabel(item.stage as OrchestrationStage) : "",
      stageTone,
      stepCount,
      jobCount,
      countsLabel: orchestrationFeedCountsLabel(stepCount, jobCount),
      timestamp: item.created_at,
      relativeTime: formatRelative(item.created_at, now),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all orchestration records in scope before the `limit` page.
 */
export function orchestrationFeedSummary(rows: readonly OrchestrationFeedRow[], total?: number): string {
  if (rows.length === 0) return "No orchestration activity";
  const count = renderCount(total ?? rows.length);
  const latest = rows[0];
  return `${count} item${count === 1 ? "" : "s"} · latest: ${latest?.kindLabel ?? "—"} in ${
    latest?.projectName ?? "—"
  }`;
}

/** Compact "generated at" label for the feed footer. */
export function orchestrationFeedGeneratedAtLabel(
  feed: OrchestrationFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope-aware empty-state copy for the feed. */
export function orchestrationFeedEmptyDescription(filtered: boolean): string {
  return filtered
    ? "No orchestration plans or runs match these filters. Try a different kind or a larger page size."
    : "Plans and execution runs will appear here as the orchestrator resolves and submits work.";
}
