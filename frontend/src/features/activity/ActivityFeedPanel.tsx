import { useState } from "react";
import { useActivity } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ActivityKind } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  ACTIVITY_KIND_FILTERS,
  type ActivityFeedItem,
  activityEmptyDescription,
  activityFeedItems,
  activityFeedSummary,
  buildActivityOptions,
} from "./activityHelpers";

const ACTIVITY_LIMITS: readonly number[] = [10, 25, 50];

function ActivityRow({
  item,
  onOpen,
}: {
  readonly item: ActivityFeedItem;
  readonly onOpen: (projectId: string) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={item.tone}>{item.kindLabel}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-content" title={item.label}>
          {item.label}
        </p>
        <p className="truncate text-xs text-content-muted" title={item.detail}>
          {item.detail}
        </p>
      </div>
      <time className="shrink-0 text-2xs text-content-subtle" dateTime={item.timestamp}>
        {item.relativeTime}
      </time>
      <Button variant="secondary" size="sm" onClick={() => onOpen(item.projectId)}>
        Open
      </Button>
    </li>
  );
}

/**
 * Authoritative cross-project workspace activity feed (C29/C31 follow-up).
 * Backed by `useActivity` so the same view works in mock and live mode; renders
 * explicit loading, error, missing-data, empty and populated states with every
 * display value derived in `activityHelpers`. Rows deep-link to the existing
 * project-detail screen without adding a new route.
 */
export function ActivityFeedPanel() {
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [limit, setLimit] = useState(50);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useActivity(
    buildActivityOptions(kind, limit),
  );
  const items = activityFeedItems(data);
  const summary = activityFeedSummary(items, data?.total);

  return (
    <Card>
      <div className="p-4">
        <SectionHeader title="Workspace activity" description={summary} />
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter activity by kind"
        >
          {ACTIVITY_KIND_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={kind === filter.value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={kind === filter.value}
              onClick={() => setKind(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Activity rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {ACTIVITY_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading workspace activity">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load workspace activity"
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
              title="Activity feed unavailable"
              description="No activity feed could be resolved right now."
            />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No activity yet" description={activityEmptyDescription(kind)} />
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                onOpen={(projectId) => navigate("projects", { projectId })}
              />
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
