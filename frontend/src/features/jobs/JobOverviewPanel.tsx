import { useState } from "react";
import { useJobOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Job } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import { jobOptionLabel } from "./jobLogHelpers";
import {
  hasJobOverviewData,
  jobOverviewEventTypeRows,
  jobOverviewGeneratedAtLabel,
  jobOverviewIdentity,
  jobOverviewRecentEvents,
  jobOverviewStatRows,
  jobOverviewSummaryLabel,
  type JobOverviewRecentEvent,
} from "./jobOverviewHelpers";

function StatGrid({
  rows,
}: {
  readonly rows: ReturnType<typeof jobOverviewStatRows>;
}) {
  return (
    <section aria-label="Job snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function EventTypeRows({
  rows,
}: {
  readonly rows: ReturnType<typeof jobOverviewEventTypeRows>;
}) {
  return (
    <section aria-label="Job events by type" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Job events by type</h3>
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
    </section>
  );
}

function RecentEvents({ rows }: { readonly rows: readonly JobOverviewRecentEvent[] }) {
  return (
    <section aria-label="Recent job events" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Recent events</h3>
      <ol className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <span className="w-10 shrink-0 text-2xs tabular-nums text-content-subtle">
              #{row.seq}
            </span>
            <span className="w-24 shrink-0">
              <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
            </span>
            <span className="w-20 shrink-0">
              <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.message}>
              {row.message}
              {row.progressPercent > 0 ? (
                <span className="ml-2 text-2xs tabular-nums text-content-subtle">
                  {Math.round(row.progressPercent)}%
                </span>
              ) : null}
            </span>
            <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
              {row.relativeTime}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface JobOverviewPanelProps {
  /** Jobs available to inspect; the panel renders a picker over them. */
  readonly jobs: readonly Job[];
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-job overview (C213/C215/C216 follow-up), backed by the
 * `useJobOverview` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `jobOverviewHelpers`. The project link
 * deep-links to the existing project-detail screen; job/identity rows stay
 * read-only because there is no job-detail route.
 */
export function JobOverviewPanel({
  jobs,
  title = "Job overview snapshot",
  description = "Compact authoritative snapshot: identity, event/retry counts, event-type breakdown and the newest events.",
}: JobOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const [selectedJobId, setSelectedJobId] = useState("");

  // Fall back to the first job when the current selection is absent (e.g. the
  // job list changed) without an effect that would fight the query cache.
  const activeJobId = jobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : (jobs[0]?.id ?? "");

  const { data, isPending, isError, error, refetch } = useJobOverview(activeJobId);
  const identity = jobOverviewIdentity(data);
  const stats = jobOverviewStatRows(data);
  const eventTypes = jobOverviewEventTypeRows(data);
  const recent = jobOverviewRecentEvents(data);
  const generatedAt = jobOverviewGeneratedAtLabel(data);
  const summary = jobOverviewSummaryLabel(data);

  const jobPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Job</span>
      <select
        aria-label="Select a job to inspect"
        className="h-8 max-w-56 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeJobId}
        onChange={(event) => setSelectedJobId(event.target.value)}
        disabled={jobs.length === 0}
      >
        {jobs.length === 0 ? <option value="">No jobs</option> : null}
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {jobOptionLabel(job)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={description} action={jobPicker} />
      </div>
      <div className="border-t border-line p-4">
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs to inspect"
            description="Submit a job to see its authoritative overview here."
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading job overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load job overview"
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
            description="The authoritative snapshot for this job is not available right now."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.operationLabel}>
                {identity.operationLabel}
              </span>
              <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
              <span className="text-2xs text-content-subtle">{identity.jobIdLabel}</span>
              <span className="text-2xs text-content-subtle">{identity.attemptLabel}</span>
              <span className="text-2xs text-content-subtle">Schema {identity.schemaLabel}</span>
              {identity.projectLabel ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("projects", { projectId: data.project_id })}
                >
                  {identity.projectLabel}
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-content-muted">
              <span>Created {identity.createdLabel || "—"}</span>
              {identity.startedLabel ? <span>Started {identity.startedLabel}</span> : null}
              {identity.finishedLabel ? <span>Finished {identity.finishedLabel}</span> : null}
            </div>

            {identity.errorLabel ? (
              <p className="rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
                {identity.errorLabel}
              </p>
            ) : null}
            {identity.resultLabel ? (
              <p className="rounded-md border border-success/35 bg-success/10 px-3 py-2 text-xs text-success">
                Result: {identity.resultLabel}
              </p>
            ) : null}

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-content-muted">
                <span>Job progress</span>
                <span className="tabular-nums text-content">{identity.progressPercent}%</span>
              </div>
              <ProgressBar value={identity.progressFraction} label="Job progress" />
            </div>

            <StatGrid rows={stats} />

            {!hasJobOverviewData(data) ? (
              <EmptyState
                title="No events recorded"
                description="This job has not emitted events or accepted retries yet."
              />
            ) : (
              <div className="space-y-4">
                <EventTypeRows rows={eventTypes} />
                <RecentEvents rows={recent} />
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
