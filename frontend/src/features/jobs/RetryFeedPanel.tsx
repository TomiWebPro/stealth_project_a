import { useState } from "react";
import { useRetryFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildRetryFeedOptions,
  retryFeedEmptyDescription,
  retryFeedGeneratedAtLabel,
  retryFeedRows,
  retryFeedSummary,
  RETRY_FEED_LIMITS,
  type RetryFeedRow,
} from "./retryFeedHelpers";

function RetryRow({
  row,
  onOpen,
}: {
  readonly row: RetryFeedRow;
  readonly onOpen: (row: RetryFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.operationId}>
          {row.operationLabel}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="font-mono">{row.jobLabel}</span> · {row.attemptLabel}
        </p>
        <p className="mt-1 truncate text-xs text-content-subtle">
          <Badge tone="accent">{row.retriesLabel}</Badge>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.retriedAt}>
          {row.relativeTime}
        </time>
        <div className="mt-1 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
            Open
          </Button>
        </div>
      </div>
    </li>
  );
}

export interface RetryFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative job retry feed (C193/C195/C196 follow-up), backed by the
 * `useRetryFeed` query hook so the same view works in mock and live mode.
 * Supports a page-size filter, renders explicit loading, error, missing-data,
 * empty and populated states, and derives every display value in
 * `retryFeedHelpers`. Rows deep-link to the existing project-detail screen
 * (there is no per-job detail route).
 */
export function RetryFeedPanel({
  projectId,
  title = "Job retries",
  description = "Newest-first retried jobs derived from the authoritative retry ledger.",
}: RetryFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useRetryFeed(
    buildRetryFeedOptions(projectId, limit),
  );
  const rows = retryFeedRows(data);
  const summary = retryFeedSummary(rows, data?.total);
  const generatedAt = retryFeedGeneratedAtLabel(data);

  return (
    <Card>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader title={title} description={rows.length === 0 ? description : summary} />
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Retry rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {RETRY_FEED_LIMITS.map((value) => (
            <Button
              key={value}
              variant={limit === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={limit === value}
              onClick={() => setLimit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading job retries">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load job retries"
              description={errorMessage(error)}
              action={
                <Button variant="primary" size="sm" onClick={() => void refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : !data ? (
          <div className="p-4">
            <EmptyState
              title="Retry feed unavailable"
              description="No retry feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No retried jobs yet"
              description={retryFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <RetryRow
                  key={row.id}
                  row={row}
                  onOpen={(target) => navigate("projects", { projectId: target.projectId })}
                />
              ))}
            </ol>
            {generatedAt ? (
              <p className="border-t border-line px-4 py-2 text-2xs text-content-subtle">
                Feed generated {generatedAt}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
