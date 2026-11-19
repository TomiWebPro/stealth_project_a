import { useJobStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { JobStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasJobStatsData,
  jobOperationRows,
  jobStatsCards,
  jobStatsGeneratedAtLabel,
  jobStatusRows,
  type JobOperationStatRow,
  type JobStatusStatRow,
} from "./jobStatsHelpers";

function StatGrid({ stats }: { readonly stats: JobStats }) {
  const cards = jobStatsCards(stats);
  return (
    <section
      aria-label="Job execution totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
    >
      {cards.map((card) => (
        <div key={card.key} className="rounded-md border border-line bg-surface-raised p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-content">{card.value}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

function StatusRows({ rows }: { readonly rows: readonly JobStatusStatRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center gap-3">
          <span className="w-20 shrink-0">
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
  );
}

function OperationRows({ rows }: { readonly rows: readonly JobOperationStatRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-content-muted">No operations recorded yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.operationId} className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-content" title={row.operationId}>
              {row.label}
            </span>
            <div className="flex items-center gap-2">
              <Badge tone="success">{`${row.succeeded} succeeded`}</Badge>
              {row.failed > 0 ? <Badge tone="danger">{`${row.failed} failed`}</Badge> : null}
              <span className="text-2xs tabular-nums text-content-subtle">{row.total} total</span>
            </div>
          </div>
          <ProgressBar value={row.successFraction} label={`${row.label} success rate`} />
          <p className="text-2xs text-content-subtle">{row.successPercent}% succeeded</p>
        </li>
      ))}
    </ul>
  );
}

function JobStatsContent({ stats }: { readonly stats: JobStats }) {
  const generatedAt = jobStatsGeneratedAtLabel(stats);
  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasJobStatsData(stats) ? (
        <EmptyState
          title="No job executions yet"
          description="Submitted jobs will populate these metrics as they run."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Jobs by status" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Jobs by status</h3>
              <StatusRows rows={jobStatusRows(stats)} />
            </section>
            <section aria-label="Jobs by operation" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Jobs by operation</h3>
              <OperationRows rows={jobOperationRows(stats)} />
            </section>
          </div>
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Metrics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface JobStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative job execution metrics from the `useJobStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `jobStatsHelpers` so JSX stays free of inline
 * derivation and mock/live transports render identically.
 */
export function JobStatsPanel({
  projectId,
  title = "Job execution stats",
  description = "Authoritative lifecycle, outcome and timing metrics derived from the job store.",
}: JobStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useJobStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading job statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
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
            title="Could not load job statistics"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Statistics unavailable"
            description="Job execution metrics are not available right now."
          />
        ) : (
          <JobStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
