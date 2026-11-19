import { useState } from "react";
import { useJobQueue } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { JobQueueView } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  hasJobQueueData,
  jobQueueCards,
  jobQueueGeneratedAtLabel,
  jobQueuePageLabel,
  jobQueueRows,
  queuePageSize,
  QUEUE_PAGE_SIZES,
  queueSharePercent,
  type JobQueueRow,
} from "./jobQueueHelpers";

function QueueCards({ view }: { readonly view: JobQueueView }) {
  const cards = jobQueueCards(view);
  return (
    <section aria-label="Dispatch queue totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function QueueComposition({ view }: { readonly view: JobQueueView }) {
  return (
    <section aria-label="Queue composition" className="space-y-2 rounded-md border border-line p-4">
      <h3 className="mb-1 text-sm font-medium text-content">Queue composition</h3>
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-xs text-content-muted">Waiting</span>
        <ProgressBar
          value={queueSharePercent(view, "waiting") / 100}
          label="Waiting share"
          className="flex-1"
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-content">
          {view.waiting}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-xs text-content-muted">Running</span>
        <ProgressBar
          value={queueSharePercent(view, "running") / 100}
          label="Running share"
          className="flex-1"
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-content">
          {view.running}
        </span>
      </div>
    </section>
  );
}

function QueueRows({
  rows,
}: {
  readonly rows: readonly JobQueueRow[];
}) {
  return (
    <ol className="space-y-2" aria-label="Active jobs in dispatch order">
      {rows.map((row) => (
        <li
          key={row.jobId || row.position}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface-raised px-3 py-2"
        >
          <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-content-subtle">
            {row.positionLabel}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-content" title={row.jobId}>
            {row.operationLabel}
          </span>
          <span className="w-16 shrink-0 text-2xs tabular-nums text-content-subtle" title={row.jobId}>
            {row.jobLabel}
          </span>
          <span className="w-20 shrink-0 truncate text-2xs text-content-muted" title={row.projectId}>
            {row.projectLabel}
          </span>
          <span className="w-24 shrink-0 text-2xs text-content-subtle" title={row.queuedAtLabel}>
            {row.queuedAtLabel}
          </span>
          <span className="w-16 shrink-0">
            <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
          </span>
        </li>
      ))}
    </ol>
  );
}

function QueueContent({
  view,
  projectNames,
}: {
  readonly view: JobQueueView;
  readonly projectNames?: Readonly<Record<string, string>>;
}) {
  const rows = jobQueueRows(view, projectNames);
  const generatedAt = jobQueueGeneratedAtLabel(view);
  const pageLabel = jobQueuePageLabel(view, rows.length);

  if (!hasJobQueueData(view)) {
    return (
      <EmptyState
        title="Dispatch queue is clear"
        description="No queued or running jobs in this scope. Submitted jobs appear here in FIFO order until they finish."
      />
    );
  }

  return (
    <div className="space-y-6">
      <QueueCards view={view} />
      <QueueComposition view={view} />
      {rows.length === 0 ? (
        <EmptyState
          title="No active jobs on this page"
          description={`${pageLabel}. Reduce the page size or refresh to see queued jobs.`}
        />
      ) : (
        <QueueRows rows={rows} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-2xs text-content-subtle">
        <span>{pageLabel}</span>
        {generatedAt ? <span>Generated {generatedAt}.</span> : null}
      </div>
    </div>
  );
}

export interface JobQueuePanelProps {
  /** Optional project scope; omitted renders the workspace-wide queue. */
  readonly projectId?: string;
  /** Friendly project names keyed by id, used for workspace-wide rows. */
  readonly projectNames?: Readonly<Record<string, string>>;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative active dispatch queue from the `useJobQueue` query. Renders
 * explicit loading, error, missing-data, empty and populated states for both
 * the workspace-wide and project-scoped variants. Every display value comes
 * from `jobQueueHelpers`, so JSX stays free of inline derivation and mock/live
 * transports render identically. Resolves the C124 screens follow-up.
 */
export function JobQueuePanel({
  projectId,
  projectNames,
  title = "Job dispatch queue",
  description = "Authoritative FIFO queue of queued and running jobs, with whole-queue counters.",
}: JobQueuePanelProps) {
  const [limit, setLimit] = useState<number>(QUEUE_PAGE_SIZES[1]!);
  const { data, isPending, isError, error, refetch, isFetching } = useJobQueue(
    projectId ? { projectId, limit: queuePageSize(limit) } : { limit: queuePageSize(limit) },
  );

  const pageSizePicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Page size</span>
      <select
        aria-label="Dispatch queue page size"
        className="h-8 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={limit}
        onChange={(event) => setLimit(Number(event.target.value))}
      >
        {QUEUE_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader
          title={title}
          description={description}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Refresh
            </Button>
          }
        />
      </div>
      <div className="space-y-4 border-t border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">{pageSizePicker}</div>

        {isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading dispatch queue">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load the dispatch queue"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Dispatch queue unavailable"
            description="The active job queue could not be resolved right now."
          />
        ) : (
          <QueueContent view={data} projectNames={projectNames} />
        )}
      </div>
    </Card>
  );
}
