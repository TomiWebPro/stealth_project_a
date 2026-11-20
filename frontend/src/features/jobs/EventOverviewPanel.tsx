import { useState } from "react";
import { useEventFeed, useEventOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import { buildEventFeedOptions } from "./eventFeedHelpers";
import type { EventTypeRow } from "./eventStatsHelpers";
import {
  EVENT_OVERVIEW_LIMITS,
  EVENT_OVERVIEW_PICKER_LIMIT,
  buildEventOverviewOptions,
  eventOverviewActiveOption,
  eventOverviewEmptyDescription,
  eventOverviewGeneratedAtLabel,
  eventOverviewIdentity,
  eventOverviewPickerOptions,
  eventOverviewRecentSiblings,
  eventOverviewStatRows,
  eventOverviewSummaryLabel,
  eventOverviewTypeRows,
  hasEventOverviewData,
  type EventOverviewSibling,
  type EventOverviewStat,
} from "./eventOverviewHelpers";

function StatGrid({ rows }: { readonly rows: readonly EventOverviewStat[] }) {
  return (
    <section aria-label="Event snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function EventTypeRows({ rows }: { readonly rows: readonly EventTypeRow[] }) {
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

function RecentSiblings({ rows }: { readonly rows: readonly EventOverviewSibling[] }) {
  return (
    <section aria-label="Recent events in this job" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest events in this job</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-content-muted">No sibling events for this snapshot yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-sm px-1 py-0.5 ${row.isCurrent ? "bg-accent-muted" : ""}`}
              aria-current={row.isCurrent ? "true" : undefined}
            >
              <span className="w-10 shrink-0 text-2xs tabular-nums text-content-subtle">
                {row.seqLabel}
              </span>
              <span className="w-24 shrink-0">
                <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
              </span>
              <span className="w-20 shrink-0">
                <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.messagePreview}>
                {row.messagePreview}
                {row.progressPercent !== null ? (
                  <span className="ml-2 text-2xs tabular-nums text-content-subtle">
                    {row.progressPercent}%
                  </span>
                ) : null}
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

export interface EventOverviewPanelProps {
  /** Optional project scope; omitted renders the workspace-wide picker. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single job-event overview (C274/C276/C277 follow-up), backed by
 * the `useEventOverview` query hook so the same view works in mock and live mode.
 * The picker is fed by the authoritative `useEventFeed` query for the active
 * project scope. Renders explicit loading, error, missing-data, empty and
 * populated states; every display value is derived in `eventOverviewHelpers`.
 * The project link deep-links to the existing project-detail screen; event rows
 * stay read-only because there is no event-detail route.
 */
export function EventOverviewPanel({
  projectId,
  title = "Event overview",
  description = "Select a job event to inspect its identity, whole-job counts and newest siblings.",
}: EventOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(5);

  const {
    data: feed,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useEventFeed(buildEventFeedOptions(projectId, undefined, EVENT_OVERVIEW_PICKER_LIMIT));

  const options = eventOverviewPickerOptions(feed);
  // Fall back to the first event when the current selection disappears (e.g. the
  // feed refreshed) without an effect fighting the query cache.
  const active = eventOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useEventOverview(
    active?.jobId ?? "",
    active?.seq ?? 0,
    buildEventOverviewOptions(recentLimit),
  );

  const identity = eventOverviewIdentity(data);
  const stats = eventOverviewStatRows(data);
  const types = eventOverviewTypeRows(data);
  const siblings = eventOverviewRecentSiblings(data);
  const generatedAt = eventOverviewGeneratedAtLabel(data);
  const summary = eventOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Event</span>
      <select
        aria-label="Select a job event to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No events</option> : null}
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
          aria-label="Sibling events shown"
        >
          <span className="text-2xs text-content-subtle">Siblings</span>
          {EVENT_OVERVIEW_LIMITS.map((value) => (
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading job events">
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
            title="Could not load job events"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No job events to inspect"
            description={eventOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading event overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load event overview"
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
            description="The authoritative snapshot for this event is not available right now."
          />
        ) : !hasEventOverviewData(data) ? (
          <EmptyState
            title="No recorded event activity"
            description="This job has no events to summarize yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={identity.typeTone}>{identity.typeLabel}</Badge>
                <Badge tone={identity.statusTone}>{identity.statusLabel}</Badge>
                <span className="text-2xs text-content-subtle">{identity.seqLabel}</span>
                <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.operationLabel}>
                  {identity.operationLabel}
                </span>
                <span className="text-2xs text-content-subtle">{identity.jobLabel}</span>
              </div>
              <p className="text-sm text-content" title={identity.messagePreview}>
                {identity.messagePreview}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
                {identity.emittedLabel ? <span>Emitted {identity.emittedLabel}</span> : null}
                {identity.progressPercent !== null ? (
                  <span className="tabular-nums">{identity.progressPercent}%</span>
                ) : null}
              </div>
              {identity.errorLabel ? (
                <p className="rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {identity.errorLabel}
                </p>
              ) : null}
              {identity.projectLabel ? (
                <div className="pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("projects", { projectId: data.project_id })}
                  >
                    Open project
                  </Button>
                </div>
              ) : null}
            </div>

            <StatGrid rows={stats} />

            <EventTypeRows rows={types} />

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
