import { useState } from "react";
import type { Job } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  ALL_JOB_STATUSES,
  canRetryJob,
  formatJobTimestamp,
  groupJobsByStatus,
  jobErrorMessage,
  jobProgressPercent,
  jobStatusLabel,
  jobStatusTone,
  summarizeJobs,
} from "./helpers";

interface JobsPanelProps {
  readonly jobs: readonly Job[];
  readonly title?: string;
  readonly description?: string;
}

function JobCard({ job }: { readonly job: Job }) {
  const retryable = canRetryJob(job);
  const error = jobErrorMessage(job);
  const [retryRequested, setRetryRequested] = useState(false);
  return (
    <li className="rounded-md border border-line bg-surface-raised p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content">{job.operation_id}</p>
          <p className="text-xs text-content-muted">
            Job {job.id.slice(0, 8)} · attempt {job.attempt ?? 1}
          </p>
        </div>
        <Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
      </div>
      {job.status === "running" || job.status === "queued" ? (
        <div className="mt-2">
          <ProgressBar value={job.progress ?? 0} label={`${job.operation_id} progress`} />
          <p className="mt-1 text-xs text-content-muted">{jobProgressPercent(job)}%</p>
        </div>
      ) : null}
      {job.status === "succeeded" && job.result?.asset_ids?.length ? (
        <p className="mt-2 text-xs text-content-muted">
          Produced {job.result.asset_ids.length} asset
          {job.result.asset_ids.length === 1 ? "" : "s"}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-content-subtle">
        <span>Created {formatJobTimestamp(job.created_at)}</span>
        {job.finished_at ? <span>Finished {formatJobTimestamp(job.finished_at)}</span> : null}
      </div>
      {retryable ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRetryRequested(true)}
            disabled={retryRequested}
          >
            {retryRequested ? "Retry requested" : "Retry job"}
          </Button>
          {retryRequested ? (
            <span className="text-xs text-content-muted" role="status">
              Retry staged locally; the jobs retry mutation is not wired yet.
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function JobsPanel({
  jobs,
  title = "Task panel",
  description = "Jobs across the production lifecycle.",
}: JobsPanelProps) {
  const groups = groupJobsByStatus(jobs);
  return (
    <Card>
      <div className="p-4">
        <SectionHeader title={title} description={`${description} ${summarizeJobs(jobs)}`} />
      </div>
      {jobs.length === 0 ? (
        <div className="border-t border-line p-4">
          <EmptyState title="No jobs" description="No jobs for this context yet." />
        </div>
      ) : (
        <div className="space-y-4 border-t border-line p-4">
          {groups.map((group) => (
            <section key={group.status} aria-label={`${group.label} jobs`}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-medium text-content">{group.label}</h3>
                <Badge tone={jobStatusTone(group.status)}>{String(group.jobs.length)}</Badge>
              </div>
              {group.jobs.length > 0 ? (
                <ul className="space-y-2">
                  {group.jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-content-subtle">
                  No {group.label.toLowerCase()} jobs.
                </p>
              )}
            </section>
          ))}
          <p className="sr-only">Statuses covered: {ALL_JOB_STATUSES.join(", ")}</p>
        </div>
      )}
    </Card>
  );
}
