import { useRetryStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { RetryStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasRetryStatsData,
  retryProjectRows,
  retryStatsCards,
  retryStatsGeneratedAtLabel,
  retryStatusRows,
  type RetryProjectRow,
  type RetryStatusRow,
} from "./retryStatsHelpers";

function StatGrid({ stats }: { readonly stats: RetryStats }) {
  const cards = retryStatsCards(stats);
  return (
    <section
      aria-label="Job retry totals"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
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

function StatusRows({ rows }: { readonly rows: readonly RetryStatusRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center gap-3">
          <span className="w-24 shrink-0">
            <Badge tone={row.tone}>{row.label}</Badge>
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.jobs}
          </span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProjectRows({ rows }: { readonly rows: readonly RetryProjectRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.projectId} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-content" title={row.projectId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.fraction}
            label={`${row.label} retry share`}
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.retries}
          </span>
          <span className="w-16 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.jobs} jobs
          </span>
        </li>
      ))}
    </ul>
  );
}

function RetryStatsContent({ stats }: { readonly stats: RetryStats }) {
  const generatedAt = retryStatsGeneratedAtLabel(stats);
  const statuses = retryStatusRows(stats);
  const projects = retryProjectRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasRetryStatsData(stats) ? (
        <EmptyState
          title="No job retries in this scope"
          description="Retried jobs will appear here as failed operations are accepted for retry."
        />
      ) : (
        <>
          <section aria-label="Retried jobs by status" className="rounded-md border border-line p-4">
            <h3 className="mb-3 text-sm font-medium text-content">Retried jobs by status</h3>
            <StatusRows rows={statuses} />
          </section>
          {projects.length > 0 ? (
            <section aria-label="Retries by project" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Retries by project</h3>
              <ProjectRows rows={projects} />
            </section>
          ) : null}
          {generatedAt ? (
            <p className="text-2xs text-content-subtle">Statistics generated {generatedAt}.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface RetryStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative job retry metrics from the `useRetryStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `retryStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C105/C107/C108.
 */
export function RetryStatsPanel({
  projectId,
  title = "Retry stats",
  description = "Authoritative job retry metrics derived from the workspace retry ledger.",
}: RetryStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useRetryStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading retry statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load retry statistics"
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
            description="Job retry metrics are not available right now."
          />
        ) : (
          <RetryStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
