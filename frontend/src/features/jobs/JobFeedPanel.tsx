import { useState } from "react";
import { useJobFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { JobStatus } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildJobFeedOptions,
  JOB_FEED_LIMITS,
  JOB_FEED_STATUS_FILTERS,
  jobFeedEmptyDescription,
  jobFeedGeneratedAtLabel,
  jobFeedRows,
  jobFeedStatusChipLabel,
  jobFeedSummary,
  type JobFeedRow,
} from "./jobFeedHelpers";

function JobRow({
  row,
  onOpen,
}: {
  readonly row: JobFeedRow;
  readonly onOpen: (row: JobFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.operationId}>
          {row.operationLabel}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="tabular-nums">{row.progressPercent}%</span> ·{" "}
          <span>{row.attemptLabel}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-2xs text-content-subtle" dateTime={row.timestamp}>
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

export interface JobFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative job feed (C141/C143/C144 follow-up), backed by the `useJobFeed`
 * query hook so the same view works in mock and live mode. Supports lifecycle
 * status and page-size filters, renders explicit loading, error,
 * missing-data, empty and populated states, and derives every display value in
 * `jobFeedHelpers`. Rows deep-link to the existing project-detail screen.
 */
export function JobFeedPanel({
  projectId,
  title = "Jobs",
  description = "Newest-first jobs derived from the authoritative job store.",
}: JobFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState<JobStatus | undefined>(undefined);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useJobFeed(
    buildJobFeedOptions(projectId, status, limit),
  );
  const rows = jobFeedRows(data);
  const summary = jobFeedSummary(rows, data?.total);
  const generatedAt = jobFeedGeneratedAtLabel(data);

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
          aria-label="Job status filter"
        >
          <span className="text-2xs text-content-subtle">Status</span>
          {JOB_FEED_STATUS_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={status === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {jobFeedStatusChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Job rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {JOB_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading jobs">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load jobs"
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
              title="Job feed unavailable"
              description="No job feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No jobs yet"
              description={jobFeedEmptyDescription(Boolean(projectId), Boolean(status))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <JobRow
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
