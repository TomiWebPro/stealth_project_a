import { useState } from "react";
import { usePublishFeed } from "../../hooks/useQueries";
import { errorMessage } from "../../lib/errors";
import { useUiStore } from "../../stores/uiStore";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, SectionHeader } from "../../ui/Card";
import { EmptyState, Skeleton } from "../../ui/Feedback";
import {
  PUBLISH_FEED_LIMITS,
  buildPublishFeedOptions,
  publishFeedEmptyDescription,
  publishFeedGeneratedAtLabel,
  publishFeedRows,
  publishFeedSummary,
  type PublishFeedRow,
} from "./publishFeedHelpers";

function PublishRow({
  row,
  onOpen,
}: {
  readonly row: PublishFeedRow;
  readonly onOpen: (row: PublishFeedRow) => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={row.typeTone}>{row.assetType}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content" title={row.assetName}>
          {row.assetName}
        </p>
        <p className="truncate text-xs text-content-muted" title={row.projectName}>
          {row.projectName} · <span className="tabular-nums">{row.versionLabel}</span> ·{" "}
          <span className="tabular-nums">{row.sizeLabel}</span>
        </p>
      </div>
      <time className="shrink-0 text-2xs text-content-subtle" dateTime={row.timestamp}>
        {row.relativeTime}
      </time>
      <Button variant="secondary" size="sm" onClick={() => onOpen(row)}>
        Open
      </Button>
    </li>
  );
}

export interface PublishFeedPanelProps {
  /** Optional project scope; omitted renders the workspace-wide feed. */
  readonly projectId?: string;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Authoritative publish feed (C125/C127/C128 follow-up), backed by the
 * `usePublishFeed` query hook so the same view works in mock and live mode.
 * Renders explicit loading, error, missing-data, empty and populated states;
 * every display value is derived in `publishFeedHelpers`. Rows deep-link to the
 * asset detail panel, scoping the assets browser to the row's project first so
 * the selected asset is always resolvable.
 */
export function PublishFeedPanel({
  projectId,
  title = "Published deliverables",
  description = "Newest-first published assets derived from authoritative publish receipts.",
}: PublishFeedPanelProps) {
  const [limit, setLimit] = useState(25);
  const navigate = useUiStore((s) => s.navigate);
  const setAssetsProjectId = useUiStore((s) => s.setAssetsProjectId);

  const { data, isPending, isError, error, refetch } = usePublishFeed(
    buildPublishFeedOptions(projectId, limit),
  );
  const rows = publishFeedRows(data);
  const summary = publishFeedSummary(rows, data?.total);
  const generatedAt = publishFeedGeneratedAtLabel(data);

  const openAsset = (row: PublishFeedRow) => {
    setAssetsProjectId(row.projectId);
    navigate("assets", { assetId: row.assetId });
  };

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
          aria-label="Published rows to show"
        >
          <span className="text-2xs text-content-subtle">Show</span>
          {PUBLISH_FEED_LIMITS.map((value) => (
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
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading published deliverables">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              title="Could not load published deliverables"
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
              title="Publish feed unavailable"
              description="No publish feed could be resolved right now."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nothing published yet"
              description={publishFeedEmptyDescription(Boolean(projectId))}
            />
          </div>
        ) : (
          <>
            <ol className="divide-y divide-line">
              {rows.map((row) => (
                <PublishRow key={row.id} row={row} onOpen={openAsset} />
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
