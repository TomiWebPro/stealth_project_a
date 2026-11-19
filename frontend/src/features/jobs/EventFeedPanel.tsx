import { useState } from "react";
import { useEventFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { JobEventType } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildEventFeedOptions,
  eventFeedEmptyDescription,
  eventFeedGeneratedAtLabel,
  eventFeedRows,
  eventFeedSummary,
  eventFeedTypeChipLabel,
  EVENT_FEED_LIMITS,
  EVENT_FEED_TYPE_FILTERS,
  type EventFeedRow,
} from "./eventFeedHelpers";

function EventRow({
  row,
  onOpen,
}: {
  readonly row: EventFeedRow;
  readonly onOpen: (row: EventFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.tone}>{row.typeLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.operationId}>
          {row.operationLabel}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="font-mono">{row.jobLabel}</span> · seq{" "}
          <span className="tabular-nums">{row.seq}</span>
          {row.statusLabel ? (
            <>
              {" · "}
              <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
            </>
          ) : null}
          {row.progressPercent !== null ? (
            <>
              {" · "}
              <span className="tabular-nums">{row.progressPercent}%</span>
            </>
          ) : null}
        </p>
        {row.message ? (
          <p className="mt-1 truncate text-xs text-content-subtle" title={row.message}>
            {row.message}
          </p>
        ) : null}
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

export interface EventFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative job event feed (C169/C171/C172 follow-up), backed by the
 * `useEventFeed` query hook so the same view works in mock and live mode.
 * Supports event-type and page-size filters, renders explicit loading, error,
 * missing-data, empty and populated states, and derives every display value in
 * `eventFeedHelpers`. Rows deep-link to the existing project-detail screen.
 */
export function EventFeedPanel({
  projectId,
  title = "Job events",
  description = "Newest-first job events derived from the authoritative event stream.",
}: EventFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const [type, setType] = useState<JobEventType | undefined>(undefined);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useEventFeed(
    buildEventFeedOptions(projectId, type, limit),
  );
  const rows = eventFeedRows(data);
  const summary = eventFeedSummary(rows, data?.total);
  const generatedAt = eventFeedGeneratedAtLabel(data);

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
          aria-label="Event type filter"
        >
          <span className="text-2xs text-content-subtle">Type</span>
          {EVENT_FEED_TYPE_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={type === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {eventFeedTypeChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Event rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {EVENT_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading job events">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load job events"
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
              title="Event feed unavailable"
              description="No event feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No job events yet"
              description={eventFeedEmptyDescription(Boolean(projectId), Boolean(type))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <EventRow
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
