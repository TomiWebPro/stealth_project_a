import { useEventStats } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { EventStats } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  eventJobRows,
  eventStatsCards,
  eventStatsGeneratedAtLabel,
  eventTypeRows,
  hasEventStatsData,
  type EventJobRow,
  type EventTypeRow,
} from "./eventStatsHelpers";

function StatGrid({ stats }: { readonly stats: EventStats }) {
  const cards = eventStatsCards(stats);
  return (
    <section
      aria-label="Job event totals"
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

function TypeRows({ rows }: { readonly rows: readonly EventTypeRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.type} className="flex items-center gap-3">
          <span className="w-24 shrink-0">
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

function JobRows({ rows }: { readonly rows: readonly EventJobRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.jobId} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-content" title={row.jobId}>
            {row.label}
          </span>
          <ProgressBar
            value={row.fraction}
            label={`${row.label} event share`}
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">
            {row.events}
          </span>
          <span className="w-24 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.newestLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EventStatsContent({ stats }: { readonly stats: EventStats }) {
  const generatedAt = eventStatsGeneratedAtLabel(stats);
  const types = eventTypeRows(stats);
  const jobs = eventJobRows(stats);

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />
      {!hasEventStatsData(stats) ? (
        <EmptyState
          title="No job events in this scope"
          description="Job events will appear here as operations emit status, progress and result signals."
        />
      ) : (
        <>
          <section aria-label="Events by type" className="rounded-md border border-line p-4">
            <h3 className="mb-3 text-sm font-medium text-content">Events by type</h3>
            <TypeRows rows={types} />
          </section>
          {jobs.length > 0 ? (
            <section aria-label="Events by job" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Events by job</h3>
              <JobRows rows={jobs} />
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

export interface EventStatsPanelProps {
  /** Optional project scope; omitted renders the workspace-wide snapshot. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative job event-stream metrics from the `useEventStats` query hook.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value comes from `eventStatsHelpers` so JSX stays free of
 * inline derivation and mock/live transports render identically. See C101/C103/C104.
 */
export function EventStatsPanel({
  projectId,
  title = "Event stats",
  description = "Authoritative job event-stream metrics derived from the workspace event store.",
}: EventStatsPanelProps) {
  const { data, isPending, isError, error, refetch } = useEventStats(
    projectId ? { projectId } : undefined,
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} />
      </div>
      <div className="border-t border-line p-4">
        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading event statistics">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load event statistics"
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
            description="Job event metrics are not available right now."
          />
        ) : (
          <EventStatsContent stats={data} />
        )}
      </div>
    </Card>
  );
}
