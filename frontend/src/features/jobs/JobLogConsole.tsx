import { useState } from "react";
import { useJobLogs } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { Job, JobLogFrame } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildJobLogsOptions,
  canLoadNewer,
  canLoadOlder,
  hasLogEntries,
  jobOptionLabel,
  logEntryRows,
  logLevelOptions,
  logPageLabel,
  type LogLevelFilter,
} from "./jobLogHelpers";

const PAGE_SIZES = [10, 25, 50] as const;

function LogLines({ frame }: { readonly frame: JobLogFrame }) {
  const rows = logEntryRows(frame.entries);
  return (
    <ol className="space-y-1 font-mono text-xs" aria-label="Job log entries">
      {rows.map((row) => (
        <li
          key={row.seq}
          className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md border border-line bg-surface-raised px-3 py-2"
        >
          <span className="w-10 shrink-0 tabular-nums text-content-subtle">#{row.seq}</span>
          <span
            className="w-24 shrink-0 truncate text-content-subtle"
            title={row.timeLabel || undefined}
          >
            {row.timeLabel || "—"}
          </span>
          <span className="w-16 shrink-0">
            <Badge tone={row.levelTone}>{row.levelLabel}</Badge>
          </span>
          <span className="min-w-0 flex-1 text-content">
            <span className="text-content-muted">{row.typeLabel}: </span>
            {row.message}
            {row.detail ? (
              <span className="ml-2 text-content-subtle">({row.detail})</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export interface JobLogConsoleProps {
  /** Jobs available to inspect; the console renders a picker over them. */
  readonly jobs: readonly Job[];
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative per-job execution log console from the `useJobLogs` query.
 * Renders explicit loading, error, missing-data, empty and populated states,
 * with severity and page-size filters plus forward/backward cursor navigation.
 * Every display value is derived in `jobLogHelpers` so JSX stays free of inline
 * derivation and mock/live transports render identically. See C117/C119/C120.
 */
export function JobLogConsole({
  jobs,
  title = "Job log console",
  description = "Chronological execution events for a selected job, derived from the authoritative event stream.",
}: JobLogConsoleProps) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [level, setLevel] = useState<LogLevelFilter>("all");
  const [limit, setLimit] = useState<number>(50);
  const [sinceSeq, setSinceSeq] = useState(0);
  const [cursorHistory, setCursorHistory] = useState<readonly number[]>([]);

  // Fall back to the first job when the current selection is absent (e.g. the
  // job list changed) without an effect that would fight the query cache.
  const activeJobId = jobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : (jobs[0]?.id ?? "");

  const options = buildJobLogsOptions(level, sinceSeq, limit);
  const { data, isPending, isError, error, refetch, isFetching } = useJobLogs(activeJobId, options);

  function resetPaging() {
    setSinceSeq(0);
    setCursorHistory([]);
  }

  function changeJob(jobId: string) {
    setSelectedJobId(jobId);
    resetPaging();
  }

  function changeLevel(next: LogLevelFilter) {
    setLevel(next);
    resetPaging();
  }

  function changeLimit(next: number) {
    setLimit(next);
    resetPaging();
  }

  function loadNewer() {
    if (!data?.next_seq) return;
    setCursorHistory((history) => [...history, sinceSeq]);
    setSinceSeq(data.next_seq ?? sinceSeq);
  }

  function loadOlder() {
    const previous = cursorHistory[cursorHistory.length - 1];
    if (previous === undefined) return;
    setCursorHistory((history) => history.slice(0, -1));
    setSinceSeq(previous);
  }

  const jobPicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Job</span>
      <select
        aria-label="Select a job to inspect"
        className="h-8 max-w-56 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={activeJobId}
        onChange={(event) => changeJob(event.target.value)}
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

  const levelChips = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Log level filter">
      {logLevelOptions().map((option) => (
        <Button
          key={option.value}
          variant={level === option.value ? "primary" : "secondary"}
          size="sm"
          aria-pressed={level === option.value}
          onClick={() => changeLevel(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  const pageSizePicker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Rows per page</span>
      <select
        aria-label="Log rows per page"
        className="h-8 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={limit}
        onChange={(event) => changeLimit(Number(event.target.value))}
      >
        {PAGE_SIZES.map((size) => (
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
        <SectionHeader title={title} description={description} action={jobPicker} />
      </div>
      <div className="space-y-4 border-t border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {levelChips}
          {pageSizePicker}
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs to inspect"
            description="Submit a job to see its execution events here."
          />
        ) : isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading job log">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-9" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load job log"
            description={errorMessage(error)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : !data ? (
          <EmptyState
            title="Log unavailable"
            description="This job's log could not be resolved."
          />
        ) : !hasLogEntries(data) ? (
          <EmptyState
            title="No log entries"
            description={
              level === "all"
                ? "This job has not emitted any execution events yet."
                : `No ${level.toLowerCase()} events were emitted by this job.`
            }
          />
        ) : (
          <>
            <LogLines frame={data} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadOlder}
                  disabled={!canLoadOlder(cursorHistory) || isFetching}
                >
                  Older
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadNewer}
                  disabled={!canLoadNewer(data, limit) || isFetching}
                >
                  Newer
                </Button>
                {canLoadOlder(cursorHistory) ? (
                  <Button variant="ghost" size="sm" onClick={resetPaging} disabled={isFetching}>
                    Reset
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-xs text-content-subtle">
                <span aria-live="polite">{logPageLabel(data)}</span>
                {isFetching ? <span role="status">Updating…</span> : null}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
