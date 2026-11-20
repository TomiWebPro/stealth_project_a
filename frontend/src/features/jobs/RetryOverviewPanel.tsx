import { useState } from "react";
import { useRetryFeed, useRetryOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { buildRetryFeedOptions } from "./retryFeedHelpers";
import {
  RETRY_OVERVIEW_LIMITS,
  RETRY_OVERVIEW_PICKER_LIMIT,
  buildRetryOverviewOptions,
  hasRetryOverviewData,
  retryOverviewActiveOption,
  retryOverviewEmptyDescription,
  retryOverviewGeneratedAtLabel,
  retryOverviewIdentity,
  retryOverviewPickerOptions,
  retryOverviewRecentSiblings,
  retryOverviewStatRows,
  retryOverviewSummaryLabel,
  type RetryOverviewIdentity,
  type RetryOverviewSibling,
  type RetryOverviewStat,
} from "./retryOverviewHelpers";

function StatGrid({ rows }: { readonly rows: readonly RetryOverviewStat[] }) {
  return (
    <section aria-label="Retry snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function IdentityHeader({ identity }: { readonly identity: RetryOverviewIdentity }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
        <span className="text-2xs text-content-subtle">{identity.attemptLabel}</span>
        <Badge tone="accent">{identity.retriesLabel}</Badge>
        <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.operationLabel}>
          {identity.operationLabel}
        </span>
        <span className="font-mono text-2xs text-content-subtle">{identity.jobLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
        {identity.projectLabel ? <span>{identity.projectLabel}</span> : null}
        {identity.retriedLabel ? <span>Retried {identity.retriedLabel}</span> : null}
      </div>
    </div>
  );
}

function RecentSiblings({ rows }: { readonly rows: readonly RetryOverviewSibling[] }) {
  return (
    <section aria-label="Recent retries in this project" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest retries in this project</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling retries for this snapshot yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-sm px-1 py-0.5 ${row.isCurrent ? "bg-accent-muted" : ""}`}
              aria-current={row.isCurrent ? "true" : undefined}
            >
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.operationLabel}>
                {row.operationLabel}
                <span className="ml-2 font-mono text-2xs text-content-subtle">{row.jobLabel}</span>
              </span>
              <span className="w-24 shrink-0">
                <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
              </span>
              <span className="w-24 shrink-0 text-2xs tabular-nums text-content-muted">
                {row.attemptLabel} · {row.retriesLabel}
              </span>
              <span className="hidden min-w-0 max-w-40 truncate text-2xs text-content-subtle" title={row.projectLabel}>
                {row.projectLabel}
              </span>
              <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
                {row.relativeTime}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface RetryOverviewPanelProps {
  /** Optional project scope; omitted renders the workspace-wide picker. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single-retried-job overview (C286/C288/C289 follow-up), backed
 * by the `useRetryOverview` query hook so the same view works in mock and live
 * mode. The picker is fed by the authoritative `useRetryFeed` query for the
 * active project scope. Renders explicit loading, error, missing-data, empty
 * and populated states; every display value is derived in `retryOverviewHelpers`.
 * The project link deep-links to the existing project-detail screen; retry rows
 * stay read-only because there is no per-job detail route.
 */
export function RetryOverviewPanel({
  projectId,
  title = "Retry overview",
  description = "Select a retried job to inspect its identity, whole-scope counts and newest siblings.",
}: RetryOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(RETRY_OVERVIEW_LIMITS[0]);

  const {
    data: feed,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useRetryFeed(buildRetryFeedOptions(projectId, RETRY_OVERVIEW_PICKER_LIMIT));

  const options = retryOverviewPickerOptions(feed);
  // Fall back to the first retried job when the current selection disappears
  // (e.g. the feed refreshed) without an effect fighting the query cache.
  const active = retryOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useRetryOverview(
    active?.jobId ?? "",
    buildRetryOverviewOptions(recentLimit),
  );

  const identity = retryOverviewIdentity(data);
  const stats = retryOverviewStatRows(data);
  const siblings = retryOverviewRecentSiblings(data);
  const generatedAt = retryOverviewGeneratedAtLabel(data);
  const summary = retryOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Retried job</span>
      <select
        aria-label="Select a retried job to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No retried jobs</option> : null}
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
        <SectionHeader title={title} description={description} action={picker} />
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Sibling retries shown"
        >
          <span className="text-2xs text-content-subtle">Siblings</span>
          {RETRY_OVERVIEW_LIMITS.map((value) => (
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading retried jobs">
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
            title="Could not load retried jobs"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No retried jobs to inspect"
            description={retryOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading retry overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load retry overview"
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
            description="The authoritative snapshot for this retried job is not available right now."
          />
        ) : !hasRetryOverviewData(data) ? (
          <EmptyState
            title="No recorded retry activity"
            description="This job has no accepted retries to summarize yet."
          />
        ) : (
          <div className="space-y-6">
            <IdentityHeader identity={identity} />
            {identity.projectLabel ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("projects", { projectId: data.project_id })}
              >
                Open project
              </Button>
            ) : null}

            <StatGrid rows={stats} />

            <RecentSiblings rows={siblings} />

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
