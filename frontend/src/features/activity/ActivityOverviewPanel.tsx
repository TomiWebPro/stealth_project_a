import { useState } from "react";
import { useActivity, useActivityOverview } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import { ProgressBar } from "../../ui/ProgressBar";
import {
  ACTIVITY_OVERVIEW_LIMITS,
  activityOverviewActiveOption,
  activityOverviewEmptyDescription,
  activityOverviewGeneratedAtLabel,
  activityOverviewIdentity,
  activityOverviewKindRows,
  activityOverviewPickerOptions,
  activityOverviewRecentEvents,
  activityOverviewStatRows,
  activityOverviewSummaryLabel,
  buildActivityOverviewOptions,
  buildActivityPickerOptions,
  hasActivityOverviewData,
  type ActivityOverviewIdentity,
  type ActivityOverviewSibling,
  type ActivityOverviewStat,
} from "./activityOverviewHelpers";
import type { ActivityKindRow } from "./activityStatsHelpers";

function StatGrid({ rows }: { readonly rows: readonly ActivityOverviewStat[] }) {
  return (
    <section aria-label="Activity snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

function IdentityHeader({ identity }: { readonly identity: ActivityOverviewIdentity }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={identity.kindTone}>{identity.kindLabel}</Badge>
        <Badge tone={identity.tone}>{identity.tone}</Badge>
        <span className="min-w-0 truncate text-sm font-semibold text-content" title={identity.label}>
          {identity.label}
        </span>
        <time className="shrink-0 text-2xs text-content-subtle">{identity.relativeTime}</time>
      </div>
      {identity.detail ? (
        <p className="truncate text-xs text-content-muted" title={identity.detail}>
          {identity.detail}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
        {identity.projectLabel ? <span>{identity.projectLabel}</span> : null}
        {identity.actorLabel ? <span className="font-mono text-2xs">{identity.actorLabel}</span> : null}
      </div>
    </div>
  );
}

function KindRows({ rows }: { readonly rows: readonly ActivityKindRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.kind} className="flex items-center gap-3">
          <span className="w-16 shrink-0">
            <Badge tone={row.tone}>{row.label}</Badge>
          </span>
          <ProgressBar value={row.fraction} label={`${row.label} share`} className="flex-1" />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-content">{row.count}</span>
          <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-content-subtle">
            {row.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentSiblings({ rows }: { readonly rows: readonly ActivityOverviewSibling[] }) {
  return (
    <section aria-label="Recent events in this project" className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-sm font-medium text-content">Newest events in this project</h3>
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
              <span className="w-16 shrink-0">
                <Badge tone={row.kindTone}>{row.kindLabel}</Badge>
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-content" title={row.label}>
                {row.label}
                {row.detail ? (
                  <span className="ml-2 text-2xs text-content-muted" title={row.detail}>
                    {row.detail}
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

export interface ActivityOverviewPanelProps {
  /** Optional project scope for the picker; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative single activity-event overview (C290/C292/C293 follow-up),
 * backed by the `useActivityOverview` query hook so the same view works in mock
 * and live mode. The picker is fed by the authoritative `useActivity` feed for
 * the active project scope. Renders explicit loading, error, missing-data, empty
 * and populated states; every display value is derived in `activityOverviewHelpers`.
 * The project link deep-links to the existing project-detail screen; event rows
 * stay read-only because there is no per-event detail route.
 */
export function ActivityOverviewPanel({
  projectId,
  title = "Activity overview",
  description = "Select an activity event to inspect its identity, project activity and newest siblings.",
}: ActivityOverviewPanelProps) {
  const navigate = useUiStore((state) => state.navigate);
  const [selectedValue, setSelectedValue] = useState("");
  const [recentLimit, setRecentLimit] = useState(ACTIVITY_OVERVIEW_LIMITS[0]);

  const {
    data: feed,
    isPending: feedPending,
    isError: feedError,
    error: feedErr,
    refetch: refetchFeed,
  } = useActivity(buildActivityPickerOptions(projectId));

  const options = activityOverviewPickerOptions(feed);
  // Fall back to the first event when the current selection disappears (e.g. the
  // feed refreshed) without an effect fighting the query cache.
  const active = activityOverviewActiveOption(options, selectedValue);

  const { data, isPending, isError, error, refetch } = useActivityOverview(
    active?.eventId ?? "",
    buildActivityOverviewOptions(recentLimit),
  );

  const identity = activityOverviewIdentity(data);
  const stats = activityOverviewStatRows(data);
  const kinds = activityOverviewKindRows(data);
  const siblings = activityOverviewRecentEvents(data);
  const generatedAt = activityOverviewGeneratedAtLabel(data);
  const summary = activityOverviewSummaryLabel(data);

  const picker = (
    <label className="flex items-center gap-2 text-xs text-content-muted">
      <span>Activity event</span>
      <select
        aria-label="Select an activity event to inspect"
        className="h-8 max-w-96 rounded-md border border-line-strong bg-surface-raised px-2 text-xs text-content"
        value={active?.value ?? ""}
        onChange={(event) => setSelectedValue(event.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">No activity events</option> : null}
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
          {ACTIVITY_OVERVIEW_LIMITS.map((value) => (
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
          <div className="space-y-6" aria-busy="true" aria-label="Loading activity events">
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
            title="Could not load activity events"
            description={errorMessage(feedErr)}
            action={
              <Button variant="primary" size="sm" onClick={() => void refetchFeed()}>
                Try again
              </Button>
            }
          />
        ) : options.length === 0 ? (
          <EmptyState
            title="No activity events to inspect"
            description={activityOverviewEmptyDescription(Boolean(projectId))}
          />
        ) : isPending ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading activity overview">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <EmptyState
            title="Could not load activity overview"
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
            description="The authoritative snapshot for this activity event is not available right now."
          />
        ) : !hasActivityOverviewData(data) ? (
          <EmptyState
            title="No recorded activity"
            description="This event's project has no activity to summarize yet."
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

            <section aria-label="Events by kind" className="rounded-md border border-line p-4">
              <h3 className="mb-3 text-sm font-medium text-content">Events by kind</h3>
              <KindRows rows={kinds} />
            </section>

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
