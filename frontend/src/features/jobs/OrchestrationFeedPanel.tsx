import { useState } from "react";
import { useOrchestrationFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { OrchestrationFeedKind } from "../../lib/types";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildOrchestrationFeedOptions,
  ORCHESTRATION_FEED_KIND_FILTERS,
  ORCHESTRATION_FEED_LIMITS,
  orchestrationFeedEmptyDescription,
  orchestrationFeedGeneratedAtLabel,
  orchestrationFeedKindChipLabel,
  orchestrationFeedRows,
  orchestrationFeedSummary,
  type OrchestrationFeedRow,
} from "./orchestrationFeedHelpers";

function OrchestrationRow({
  row,
  onOpen,
}: {
  readonly row: OrchestrationFeedRow;
  readonly onOpen: (row: OrchestrationFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex shrink-0 flex-col items-start gap-1">
        <Badge tone={row.kindTone}>{row.kindLabel}</Badge>
        {row.stageTone ? <Badge tone={row.stageTone}>{row.stageLabel}</Badge> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.detailLabel}>
          {row.detailLabel} <span className="font-mono text-xs text-content-muted">({row.shortId})</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · {row.countsLabel}
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

export interface OrchestrationFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative orchestration feed (C181/C183/C184 follow-up), backed by the
 * `useOrchestrationFeed` query hook so the same view works in mock and live mode.
 * Supports kind and page-size filters, renders explicit loading, error,
 * missing-data, empty and populated states, and derives every display value in
 * `orchestrationFeedHelpers`. Rows deep-link to the existing project-detail
 * screen for the joined project.
 */
export function OrchestrationFeedPanel({
  projectId,
  title = "Orchestration feed",
  description = "Newest-first plans and execution runs derived from the authoritative orchestration stores.",
}: OrchestrationFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const [kind, setKind] = useState<OrchestrationFeedKind | undefined>(undefined);
  const navigate = useUiStore((s) => s.navigate);

  const { data, isPending, isError, error, refetch } = useOrchestrationFeed(
    buildOrchestrationFeedOptions(projectId, kind, limit),
  );
  const rows = orchestrationFeedRows(data);
  const summary = orchestrationFeedSummary(rows, data?.total);
  const generatedAt = orchestrationFeedGeneratedAtLabel(data);

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
          aria-label="Orchestration record kind filter"
        >
          <span className="text-2xs text-content-subtle">Kind</span>
          {ORCHESTRATION_FEED_KIND_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={kind === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {orchestrationFeedKindChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Orchestration records to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {ORCHESTRATION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading orchestration feed">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load the orchestration feed"
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
              title="Orchestration feed unavailable"
              description="No orchestration feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No orchestration activity yet"
              description={orchestrationFeedEmptyDescription(Boolean(projectId) || kind !== undefined)}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <OrchestrationRow
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
