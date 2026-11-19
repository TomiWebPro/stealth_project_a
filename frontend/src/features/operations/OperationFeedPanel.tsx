import { useState } from "react";
import { useOperationFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildOperationFeedOptions,
  operationFeedEmptyDescription,
  operationFeedGeneratedAtLabel,
  operationFeedRows,
  operationFeedStreamingChipLabel,
  operationFeedSummary,
  OPERATION_FEED_LIMITS,
  OPERATION_FEED_STREAMING_FILTERS,
  type OperationFeedRow,
} from "./operationFeedHelpers";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-content placeholder:text-content-subtle";

function OperationRow({ row }: { readonly row: OperationFeedRow }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-content" title={row.id}>
            {row.title}
          </p>
          <Badge tone={row.streamingTone}>{row.streamingLabel}</Badge>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-content-muted" title={row.id}>
          {row.id}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.description}>
          {row.description}
        </p>
        <p className="mt-1 truncate text-xs text-content-muted" title={row.inputLabel}>
          {row.inputLabel}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.outputLabel}>
          {row.outputLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge tone="info">{row.versionLabel}</Badge>
          <Badge tone="neutral">{row.settingsLabel}</Badge>
          <Badge tone="neutral">{row.providerLabel}</Badge>
        </div>
        <p className="mt-1 truncate text-2xs text-content-subtle" title={row.providerPreview}>
          {row.providerPreview}
        </p>
      </div>
    </li>
  );
}

export interface OperationFeedPanelProps {
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative operation catalog feed (C189/C191/C192 follow-up), backed by the
 * `useOperationFeed` query hook so the same view works in mock and live mode.
 * Supports streaming/provider/page-size filters and renders explicit loading,
 * error, missing-data, empty and populated states; every display value is
 * derived in `operationFeedHelpers`. Rows are ordered by title/operation id (the
 * catalog has no registration timestamp), so there is no per-item relative-time
 * column — only the feed's generated-at footer. Rows stay read-only because
 * there is no operation-detail route; no new route was added.
 */
export function OperationFeedPanel({
  title = "Operation catalog feed",
  description = "Operations projected from the authoritative catalog, ordered by title.",
}: OperationFeedPanelProps) {
  const [streaming, setStreaming] = useState<boolean | undefined>(undefined);
  const [providerId, setProviderId] = useState("");
  const [limit, setLimit] = useState(25);

  const { data, isPending, isError, error, refetch } = useOperationFeed(
    buildOperationFeedOptions(streaming, providerId, limit),
  );
  const rows = operationFeedRows(data);
  const summary = operationFeedSummary(rows, data?.total);
  const generatedAt = operationFeedGeneratedAtLabel(data);
  const filtered = streaming !== undefined || providerId.trim() !== "";

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
          aria-label="Operation streaming filter"
        >
          <span className="text-2xs text-content-subtle">Mode</span>
          {OPERATION_FEED_STREAMING_FILTERS.map((value) => (
            <Button
              key={value === undefined ? "all" : String(value)}
              variant={streaming === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={streaming === value}
              onClick={() => setStreaming(value)}
            >
              {operationFeedStreamingChipLabel(value)}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-2xs text-content-subtle">
            Provider ID
            <input
              className={inputClass}
              value={providerId}
              placeholder="All providers"
              aria-label="Filter operations by provider id"
              onChange={(event) => setProviderId(event.target.value)}
            />
          </label>
          {providerId ? (
            <Button variant="ghost" size="sm" onClick={() => setProviderId("")}>
              Clear
            </Button>
          ) : null}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Operations to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {OPERATION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading operation feed">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load operation feed"
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
              title="Operation feed unavailable"
              description="No operation feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No operations in this scope" description={operationFeedEmptyDescription(filtered)} />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <OperationRow key={row.id} row={row} />
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
