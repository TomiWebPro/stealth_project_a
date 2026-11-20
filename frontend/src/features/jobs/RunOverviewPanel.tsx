import { useState } from "react";
import { useOrchestrationFeed, useRunOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  buildRunPickerFeedOptions,
  hasRunOverviewData,
  RUN_OVERVIEW_RECENT_LIMITS,
  runOverviewGeneratedAtLabel,
  runOverviewIdentity,
  runOverviewJobRows,
  runOverviewOptions,
  runOverviewStatRows,
  runOverviewStatusRows,
  runOverviewSummaryLabel,
  runPickerOptions,
  type RunOverviewJobRow,
  type RunOverviewStat,
  type RunOverviewStatusRow,
} from "./runOverviewHelpers";

function StatGrid({ rows }: { readonly rows: readonly RunOverviewStat[] }) {
  return (
    <section aria-label="Run overview" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function StatusRows({ rows }: { readonly rows: readonly RunOverviewStatusRow[] }) {
  return (
    <section aria-label="Resolved job status distribution" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Resolved jobs by status</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center gap-3">
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

function RecentJobs({ rows }: { readonly rows: readonly RunOverviewJobRow[] }) {
  return (
    <section aria-label="Recent run jobs" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent jobs</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No resolved jobs recorded for this run yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
                <span className="min-w-0 truncate text-xs font-medium text-content">
                  {row.operationLabel}
                </span>
                <span className="text-2xs text-content-subtle" title={row.id}>
                  {row.shortId}
                </span>
                <time className="ml-auto text-2xs text-content-subtle" dateTime={row.timestamp}>
                  {row.relativeTime}
                </time>
              </div>
              <ProgressBar
                value={row.progressFraction}
                label={`${row.operationLabel} progress`}
                className="max-w-xs"
              />
              <p className="text-2xs tabular-nums text-content-muted">{row.progressPercent}% complete</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface RunOverviewPanelProps {
  /** Optional project scope; omitted inspects runs across the workspace. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-orchestration-run overview (C242/C244/C245 follow-up),
 * backed by the `useRunOverview` query hook so the same view works in mock and
 * live mode. The picker is populated from the authoritative `useOrchestrationFeed`
 * query (run records only), optionally scoped to `projectId`. Renders explicit
 * loading, error, missing-data, empty and populated states; every display value
 * is derived in `runOverviewHelpers`. Job rows stay read-only (no job-detail
 * route); the run's project deep-links to project detail.
 */
export function RunOverviewPanel({
  projectId,
  title = "Run overview snapshot",
  description = "Select an orchestration run to inspect its identity, whole-run counts and newest resolved jobs.",
}: RunOverviewPanelProps) {
  const navigate = useUiStore((s) => s.navigate);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [recentLimit, setRecentLimit] = useState(5);

  const {
    data: feedData,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useOrchestrationFeed(buildRunPickerFeedOptions(projectId));

  const options = runPickerOptions(feedData);
  // Fall back to the first run when the current selection disappears (e.g. the
  // feed changed) without an effect fighting the query cache.
  const activeRunId = options.some((option) => option.value === selectedRunId)
    ? selectedRunId
    : (options[0]?.value ?? "");

  const { data, isPending, isError, error, refetch } = useRunOverview(
    activeRunId,
    runOverviewOptions(recentLimit),
  );

  const identity = runOverviewIdentity(data);
  const stats = runOverviewStatRows(data);
  const statuses = runOverviewStatusRows(data);
  const jobs = runOverviewJobRows(data);
  const generatedAt = runOverviewGeneratedAtLabel(data);
  const summary = runOverviewSummaryLabel(data);

  const runPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Run</span>
      <select
        aria-label="Select an orchestration run to inspect"
        className="h-8 max-w-80 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeRunId}
        onChange={(event) => setSelectedRunId(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No runs</option> : null}
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
        <SectionHeader title={title} description={description} action={runPicker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Recent jobs to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {RUN_OVERVIEW_RECENT_LIMITS.map((value) => (
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading orchestration runs">
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
            title="Could not load orchestration runs"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No orchestration runs to inspect"
            description="Runs will appear here as the orchestrator starts executing plans."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading run overview">
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
            title="Could not load run overview"
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
            description="The authoritative snapshot for this run is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.stageTone}>{identity.stageLabel}</Badge>
                <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.runIdLabel}>
                  Run {identity.runIdLabel}
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
                {identity.createdLabel ? ` · started ${identity.createdLabel}` : ""}
                {` · plan ${identity.planIdLabel}`}
              </p>
              <p className="text-xs text-content-subtle">{identity.planGoalLabel}</p>
            </div>

            <StatGrid rows={stats} />

            {!hasRunOverviewData(data) ? (
              <EmptyState
                title="No run activity"
                description="This run has no plan steps, linked jobs or resolved jobs yet."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <StatusRows rows={statuses} />
                <RecentJobs rows={jobs} />
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
