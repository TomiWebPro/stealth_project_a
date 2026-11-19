import { useState } from "react";
import { useExtensionFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import type { ExtensionStatus, ExtensionType } from "../../lib/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  buildExtensionFeedOptions,
  extensionFeedEmptyDescription,
  extensionFeedGeneratedAtLabel,
  extensionFeedRows,
  extensionFeedStatusChipLabel,
  extensionFeedSummary,
  extensionFeedTypeChipLabel,
  EXTENSION_FEED_LIMITS,
  EXTENSION_FEED_STATUS_FILTERS,
  EXTENSION_FEED_TYPE_FILTERS,
  type ExtensionFeedRow,
} from "./extensionFeedHelpers";

function ExtensionRow({ row }: { readonly row: ExtensionFeedRow }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.manifestId}>
          {row.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-content-muted" title={row.publisher}>
          {row.publisher} · <span className="font-mono">{row.versionLabel}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge tone={row.typeTone}>{row.typeLabel}</Badge>
          <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
          <Badge tone={row.trustTone}>{row.trustLabel}</Badge>
        </div>
      </div>
      <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
        {row.relativeTime}
      </time>
    </li>
  );
}

export interface ExtensionFeedPanelProps {
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative extension installation feed (C173/C175/C176 follow-up), backed
 * by the `useExtensionFeed` query hook so the same view works in mock and live
 * mode. Supports type, status and page-size filters and renders explicit
 * loading, error, missing-data, empty and populated states; every display value
 * is derived in `extensionFeedHelpers`. There is no extension-detail route, so
 * rows stay read-only rather than deep-linking to an unrelated screen.
 */
export function ExtensionFeedPanel({
  title = "Extension activity",
  description = "Newest-first installations derived from the authoritative extension store.",
}: ExtensionFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const [type, setType] = useState<ExtensionType | undefined>(undefined);
  const [status, setStatus] = useState<ExtensionStatus | undefined>(undefined);

  const { data, isPending, isError, error, refetch } = useExtensionFeed(
    buildExtensionFeedOptions(type, status, limit),
  );
  const rows = extensionFeedRows(data);
  const summary = extensionFeedSummary(rows, data?.total);
  const generatedAt = extensionFeedGeneratedAtLabel(data);
  const filtered = type !== undefined || status !== undefined;

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
          aria-label="Extension type filter"
        >
          <span className="text-2xs text-content-subtle">Type</span>
          {EXTENSION_FEED_TYPE_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={type === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {extensionFeedTypeChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Extension status filter"
        >
          <span className="text-2xs text-content-subtle">Status</span>
          {EXTENSION_FEED_STATUS_FILTERS.map((value) => (
            <Button
              key={value ?? "all"}
              variant={status === value ? "primary" : "secondary"}
              size="sm"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {extensionFeedStatusChipLabel(value)}
            </Button>
          ))}
        </div>
        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Extensions to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {EXTENSION_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading extension activity">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load extension activity"
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
              title="Extension feed unavailable"
              description="No extension feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No extensions installed yet" description={extensionFeedEmptyDescription(filtered)} />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <ExtensionRow key={row.id} row={row} />
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
