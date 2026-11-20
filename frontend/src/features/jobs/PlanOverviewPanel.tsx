import { useState } from "react";
import { useOrchestrationFeed, usePlanOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  buildPlanPickerFeedOptions,
  hasPlanOverviewData,
  planOverviewGeneratedAtLabel,
  planOverviewIdentity,
  planOverviewOptions,
  PLAN_OVERVIEW_RECENT_LIMITS,
  planOverviewStageRows,
  planOverviewStatRows,
  planOverviewSummaryLabel,
  planPickerOptions,
  planRunRows,
  type PlanOverviewStageRow,
  type PlanOverviewStat,
  type PlanRunRow,
} from "./planOverviewHelpers";

function StatGrid({ rows }: { readonly rows: readonly PlanOverviewStat[] }) {
  return (
    <section aria-label="Plan overview" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {rows.map((row) => (
        <div key={row.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {row.label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tabular-nums text-content" title={row.value}>
            {row.value}
          </p>
          <p className="mt-0.5 text-2xs text-content-muted">{row.hint}</p>
        </div>
      ))}
    </section>
  );
}

function StageRows({ rows }: { readonly rows: readonly PlanOverviewStageRow[] }) {
  return (
    <section aria-label="Run stage distribution" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Run stages</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.stage} className="flex items-center gap-3">
            <span className="w-16 shrink-0">
              <Badge tone={row.tone}>{row.label}</Badge>
            </span>
            <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
              {row.count}
            </span>
            <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
              {row.percent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentRuns({ rows }: { readonly rows: readonly PlanRunRow[] }) {
  return (
    <section aria-label="Recent plan runs" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent runs</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No runs recorded for this plan yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge tone={row.stageTone}>{row.stageLabel}</Badge>
              <span className="text-2xs text-content-subtle" title={row.id}>
                {row.shortId}
              </span>
              <span className="text-2xs text-content-muted">{row.jobCountLabel}</span>
              <time className="ml-auto text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface PlanOverviewPanelProps {
  /** Optional project scope; omitted inspects plans across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-orchestration-plan overview (C238/C240/C241 follow-up),
 * backed by the `usePlanOverview` query hook so the same view works in mock and
 * live mode. The picker is populated from the authoritative `useOrchestrationFeed`
 * query (plan records only), optionally scoped to `projectId`. Renders explicit
 * loading, error, missing-data, empty and populated states; every display value
 * is derived in `planOverviewHelpers`. Run rows stay read-only (no run-detail
 * route); the plan's project deep-links to project detail.
 */
export function PlanOverviewPanel({
  projectId,
  title = "Plan overview snapshot",
  description = "Select an orchestration plan to inspect its identity, whole-plan counts and newest runs.",
}: PlanOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [recentLimit, setRecentLimit] = useState(5);

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useOrchestrationFeed(buildPlanPickerFeedOptions(projectId));

  const options = planPickerOptions(feedData);
  // Fall back to the first plan when the current selection disappears (e.g. the
  // feed changed) without an effect fighting the query cache.
  const activePlanId = options.some((option) => option.value === selectedPlanId)
    ? selectedPlanId
    : (options[0]?.value ?? "");

  const { data, isPending, isError, error, refetch } = usePlanOverview(
    activePlanId,
    planOverviewOptions(recentLimit),
  );

  const identity = planOverviewIdentity(data);
  const stats = planOverviewStatRows(data);
  const stages = planOverviewStageRows(data);
  const runs = planRunRows(data);
  const generatedAt = planOverviewGeneratedAtLabel(data);
  const summary = planOverviewSummaryLabel(data);

  const planPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Plan</span>
      <select
        aria-label="Select an orchestration plan to inspect"
        className="h-8 max-w-72 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activePlanId}
        onChange={(event) => setSelectedPlanId(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No plans</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={planPicker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Recent runs to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {PLAN_OVERVIEW_RECENT_LIMITS.map((value) => (
            <Button
              key={value}
              variant={recentLimit === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={recentLimit === value}
              onClick={() => setRecentLimit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line p-4">
        {feedPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading orchestration plans">
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : feedError ? (
          <EmptyState
            title="Could not load orchestration plans"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No orchestration plans to inspect"
            description="Plans will appear here as the orchestrator resolves and submits work."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading plan overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load plan overview"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Overview unavailable"
            description="The authoritative snapshot for this plan is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">Plan</Badge>
                <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.planIdLabel}>
                  Plan {identity.planIdLabel}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!identity.projectId}
                  onClick={() => navigate("projects", { projectId: identity.projectId })}
                >
                  Open project
                </Button>
              </div>
              <p className="text-xs text-content-muted">
                {identity.projectName}
                {identity.createdLabel ? ` · created ${identity.createdLabel}` : ""}
                {` · ${identity.goalLabel}`}
              </p>
            </div>

            <StatGrid rows={stats} />

            {!hasPlanOverviewData(data) ? (
              <EmptyState
                title="No plan activity"
                description="This plan has no steps, runs or linked jobs yet."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <StageRows rows={stages} />
                <RecentRuns rows={runs} />
              </div>
            )}

            {generatedAt ? (
              <p className="text-2xs text-content-subtle">
                {summary} · Snapshot generated {generatedAt}.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
